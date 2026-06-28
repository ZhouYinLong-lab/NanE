/**
 * Admin router — admin login, item review, stats, and the admin console HTML page.
 */
const fs = require("fs");
const path = require("path");
const { query, makeId, hashPassword, DEMO_USER_ID } = require("../db");
const { readBody, json, html } = require("../lib/util");
const { signToken } = require("../lib/jwt");
const { requireAdmin } = require("../middleware/auth");
const { itemFromRow, attachOwnerTrustSummaries } = require("../lib/item-utils");

const DEBUG_MODE = String(process.env.DEBUG_MODE || "false").toLowerCase() === "true";

async function demoViewer() {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [DEMO_USER_ID]);
  return rows[0];
}

async function adminLogin(req, res) {
  const input = await readBody(req);
  const { rows } = await query("SELECT * FROM admins WHERE username = $1", [input.username || ""]);
  const admin = rows[0];
  if (!admin || admin.password_hash !== hashPassword(input.password || "")) {
    json(res, 401, { error: "INVALID_LOGIN", message: "管理员账号或密码错误" });
    return;
  }
  json(res, 200, {
    token: signToken({ sub: admin.id, role: "admin", adminRole: admin.role, username: admin.username })
  });
}

async function adminItems(req, res) {
  const url = new URL(req.url, "http://localhost");
  const status = url.searchParams.get("status") || "reviewing";

  await query("UPDATE items SET status = 'expired' WHERE status = 'online' AND no_expiry = false AND expire_date < CURRENT_DATE");

  const params = [];
  const clauses = [];
  if (status !== "all") {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (!DEBUG_MODE) {
    clauses.push(`owner_id NOT IN ('u_demo')`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(`SELECT * FROM items ${where} ORDER BY created_at DESC`, params);
  const viewer = await demoViewer();
  const items = await attachOwnerTrustSummaries(rows.map(row => itemFromRow(row, viewer, { includeContact: true, includeRoom: true })));
  json(res, 200, { items });
}

async function reviewItem(req, res, itemId, action) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }
  const input = await readBody(req);
  const status = action === "approve" ? "online" : action === "reject" ? "rejected" : "taken_down";
  const reason = String(input.reason || "").trim();
  const { rows } = await query(
    `UPDATE items
     SET status = $1, reject_reason = $2, reviewed_at = now()
     WHERE id = $3
     RETURNING *`,
    [status, action === "reject" ? reason || "未通过审核" : null, itemId]
  );
  if (!rows[0]) {
    json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
    return;
  }
  await query(
    "INSERT INTO review_logs (id, item_id, admin_id, action, reason) VALUES ($1, $2, $3, $4, $5)",
    [makeId("log"), itemId, admin.sub, action, reason || null]
  );
  const viewer = await demoViewer();
  const [item] = await attachOwnerTrustSummaries([itemFromRow(rows[0], viewer, { includeContact: true, includeRoom: true })]);
  json(res, 200, { item });
}

async function adminStats(req, res) {
  const testFilter = !DEBUG_MODE ? "WHERE owner_id NOT IN ('u_demo')" : "";
  const claimFilter = !DEBUG_MODE ? "AND i.owner_id NOT IN ('u_demo')" : "";
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'reviewing')::int AS reviewing,
       COUNT(*) FILTER (WHERE status = 'online')::int AS online,
       COUNT(*) FILTER (WHERE status IN ('expired', 'taken_down', 'claimed'))::int AS offline,
       (SELECT COUNT(*)::int FROM contact_views WHERE view_date = CURRENT_DATE) AS contact_views_today,
       (SELECT COUNT(*)::int
        FROM claim_requests cr
        JOIN items i ON i.id = cr.item_id
        WHERE cr.status = 'confirmed' ${claimFilter}) AS confirmed_claims,
       (SELECT COUNT(*)::int
        FROM fulfillment_reviews fr
        JOIN items i ON i.id = fr.item_id
        WHERE true ${claimFilter}) AS fulfillment_reviews,
       (SELECT COUNT(*)::int FROM users) AS total_users,
       (SELECT COUNT(*)::int FROM users WHERE is_banned = true) AS banned_users,
       (SELECT COUNT(*)::int FROM users WHERE created_at >= CURRENT_DATE) AS new_users_today
     FROM items ${testFilter}`
  );
  json(res, 200, rows[0]);
}

async function batchReviewItems(req, res) {
  const admin = await requireAdmin(req, res, "moderator");
  if (!admin) return;
  const input = await readBody(req);
  const { ids, action, reason } = input;
  if (!Array.isArray(ids) || !ids.length) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请选择至少一个物品" });
    return;
  }
  if (!["approve", "reject", "take-down"].includes(action)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "无效的操作" });
    return;
  }
  const status = action === "approve" ? "online" : action === "reject" ? "rejected" : "taken_down";
  const rejectReason = action === "reject" ? (reason || "未通过审核") : null;
  const results = [];
  for (const id of ids) {
    const { rows } = await query(
      `UPDATE items SET status = $1, reject_reason = $2, reviewed_at = now()
       WHERE id = $3 RETURNING *`,
      [status, rejectReason, id]
    );
    if (rows[0]) {
      await query(
        "INSERT INTO review_logs (id, item_id, admin_id, action, reason) VALUES ($1, $2, $3, $4, $5)",
        [makeId("log"), id, admin.sub, action, rejectReason]
      );
      results.push(rows[0].id);
    }
  }
  json(res, 200, { reviewed: results.length, total: ids.length, message: `已处理 ${results.length}/${ids.length} 个物品` });
}

async function listAdmins(req, res) {
  const { rows } = await query("SELECT id, username, role, created_at FROM admins ORDER BY created_at ASC");
  json(res, 200, { admins: rows });
}

async function createAdmin(req, res) {
  const input = await readBody(req);
  const { username, password, role } = input;
  if (!username || !password) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "用户名和密码不能为空" });
    return;
  }
  const validRoles = ["super_admin", "moderator", "viewer"];
  const adminRole = role && validRoles.includes(role) ? role : "viewer";
  try {
    const { rows } = await query(
      `INSERT INTO admins (id, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, role, created_at`,
      [makeId("admin"), username, hashPassword(password), adminRole]
    );
    json(res, 201, { admin: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      json(res, 409, { error: "DUPLICATE", message: "用户名已存在" });
      return;
    }
    throw err;
  }
}

async function deleteAdmin(req, res, adminId) {
  const currentAdmin = await requireAdmin(req, res, "super_admin");
  if (!currentAdmin) return;
  if (adminId === currentAdmin.sub) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "不能删除自己" });
    return;
  }
  const { rows: targetRows } = await query("SELECT role FROM admins WHERE id = $1", [adminId]);
  if (!targetRows[0]) {
    json(res, 404, { error: "NOT_FOUND", message: "管理员不存在" });
    return;
  }
  // Prevent deleting the last super_admin
  if (targetRows[0].role === "super_admin") {
    const { rows: superRows } = await query("SELECT COUNT(*)::int AS count FROM admins WHERE role = 'super_admin'");
    if (superRows[0].count <= 1) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "无法删除最后一个超级管理员" });
      return;
    }
  }
  await query("DELETE FROM admins WHERE id = $1", [adminId]);
  json(res, 200, { message: "管理员已删除" });
}

async function listUsers(req, res) {
  const url = new URL(req.url, "http://localhost");
  const keyword = url.searchParams.get("keyword") || "";
  const isVerified = url.searchParams.get("is_verified");
  const isBanned = url.searchParams.get("is_banned");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
  const offset = (page - 1) * pageSize;

  const params = [];
  const clauses = [];

  if (keyword) {
    params.push(`%${keyword}%`);
    clauses.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (isVerified === "true") {
    params.push(true);
    clauses.push(`is_verified = $${params.length}`);
  } else if (isVerified === "false") {
    params.push(false);
    clauses.push(`is_verified = $${params.length}`);
  }
  if (isBanned === "true") {
    params.push(true);
    clauses.push(`is_banned = $${params.length}`);
  } else if (isBanned === "false") {
    params.push(false);
    clauses.push(`is_banned = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM users ${where}`, params);
  const total = countResult.rows[0].total;
  params.push(pageSize);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;
  const { rows } = await query(
    `SELECT id, name, campus, building, email, student_id_masked, major, is_verified, is_banned, ban_reason, auth_provider, created_at
     FROM users ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  json(res, 200, { users: rows, total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) });
}

async function toggleUserBan(req, res, userId) {
  const admin = await requireAdmin(req, res, "moderator");
  if (!admin) return;
  const input = await readBody(req);
  const { ban, reason } = input;
  const { rows } = await query(
    `UPDATE users SET is_banned = $1, ban_reason = $2 WHERE id = $3 RETURNING id, name, is_banned, ban_reason`,
    [ban === true, ban === true ? (reason || null) : null, userId]
  );
  if (!rows[0]) {
    json(res, 404, { error: "NOT_FOUND", message: "用户不存在" });
    return;
  }
  json(res, 200, { user: rows[0] });
}

function adminPage() {
  return fs.readFileSync(path.join(__dirname, "..", "..", "admin", "index.html"), "utf8");
}

async function handle(req, res, pathname, method) {
  // GET /admin — admin console page
  if (method === "GET" && pathname === "/admin") {
    html(res, adminPage());
    return true;
  }

  // POST /api/admin/login — no auth required
  if (method === "POST" && pathname === "/api/admin/login") {
    await adminLogin(req, res);
    return true;
  }

  // POST /api/admin/items/batch — moderator+ only
  if (method === "POST" && pathname === "/api/admin/items/batch") {
    await batchReviewItems(req, res);
    return true;
  }

  // Admin management routes — super_admin only
  if (method === "GET" && pathname === "/api/admin/admins") {
    const admin = await requireAdmin(req, res, "super_admin");
    if (!admin) return true;
    await listAdmins(req, res);
    return true;
  }
  if (method === "POST" && pathname === "/api/admin/admins") {
    const admin = await requireAdmin(req, res, "super_admin");
    if (!admin) return true;
    await createAdmin(req, res);
    return true;
  }
  const adminDeleteMatch = pathname.match(/^\/api\/admin\/admins\/([^/]+)$/);
  if (method === "DELETE" && adminDeleteMatch) {
    const admin = await requireAdmin(req, res, "super_admin");
    if (!admin) return true;
    await deleteAdmin(req, res, adminDeleteMatch[1]);
    return true;
  }

  // User management routes — moderator+ only
  if (method === "GET" && pathname === "/api/admin/users") {
    const admin = await requireAdmin(req, res, "moderator");
    if (!admin) return true;
    await listUsers(req, res);
    return true;
  }
  const userBanMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/ban$/);
  if (method === "POST" && userBanMatch) {
    const admin = await requireAdmin(req, res, "moderator");
    if (!admin) return true;
    await toggleUserBan(req, res, userBanMatch[1]);
    return true;
  }

  // All other /api/admin/* routes require generic admin authentication
  if (pathname.startsWith("/api/admin/")) {
    const admin = await requireAdmin(req, res);
    if (!admin) return true;

    if (method === "GET" && pathname === "/api/admin/items") {
      await adminItems(req, res);
      return true;
    }
    if (method === "GET" && pathname === "/api/admin/stats") {
      await adminStats(req, res);
      return true;
    }
    const reviewMatch = pathname.match(/^\/api\/admin\/items\/([^/]+)\/(approve|reject|take-down)$/);
    if (method === "POST" && reviewMatch) {
      await reviewItem(req, res, reviewMatch[1], reviewMatch[2].replace("take-down", "take_down"));
      return true;
    }
  }

  return false;
}

module.exports = { handle, adminPage };
