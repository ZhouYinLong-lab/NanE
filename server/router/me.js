const path = require("path");
const fs = require("fs");
const { query } = require("../db");
const { readBody, json, dateOnly, parsePgArray, normalizeImageUrls, REVIEW_TAGS, ISSUE_REVIEW_TAGS } = require("../lib/util");
const { logError } = require("../lib/logger");
const { deleteLocalImageIfUnused } = require("../service/image-upload");
const { userFromRequest, requireVerifiedUser, locationExists, userHasAgreement } = require("../middleware/auth");
const { emptyTrustSummary } = require("../lib/util");
const { publicUser } = require("../lib/jwt");
const { trustSummariesForUsers, attachOwnerTrustSummaries, itemFromRow, claimFromRow, ITEM_TYPES, pendingReviewFromRow } = require("../lib/item-utils");

const AGREEMENT_VERSION = "v1.0";

// --- Local helpers (transplanted from server/index.js) ---

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

// --- Extracted handler functions ---

async function updateProfile(req, res) {
  const user = await userFromRequest(req);
  if (!user || !user.is_verified) {
    json(res, 401, { error: "AUTH_REQUIRED", message: "请先登录后再设置账号资料" });
    return;
  }
  if (!userHasAgreement(user)) {
    json(res, 403, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  const input = await readBody(req);
  const name = String(input.name || "").trim();
  const campus = String(input.campus || "").trim();
  const building = String(input.building || "").trim();
  const room = String(input.room || "").trim();
  if (name.length < 2 || name.length > 16) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "昵称需为 2-16 个字符" });
    return;
  }
  if (!locationExists(campus, building, room)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请选择有效的校区、楼栋和宿舍号" });
    return;
  }
  const { rows } = await query(
    `UPDATE users
     SET name = $1, campus = $2, building = $3, room = $4
     WHERE id = $5
     RETURNING *`,
    [name, campus, building, room || null, user.id]
  );
  json(res, 200, { user: publicUser(rows[0]), message: "账号资料已更新" });
}

async function expiredCount(req, res) {
  const user = await requireVerifiedUser(req, res);
  if (!user) {
    return;
  }
  const { rows } = await query(
    "SELECT COUNT(*)::int AS count FROM items WHERE owner_id = $1 AND status = 'expired'",
    [user.id]
  );
  json(res, 200, { count: rows[0].count });
}

async function listPendingReviews(req, res, viewer) {
  const { rows } = await query(
    `SELECT cr.*, i.title AS item_title, i.item_type, i.category, i.unit, i.owner_id, i.owner_name
     FROM claim_requests cr
     JOIN items i ON i.id = cr.item_id
     LEFT JOIN fulfillment_reviews fr ON fr.claim_id = cr.id AND fr.reviewer_id = $1
     WHERE cr.status = 'confirmed'
       AND (i.owner_id = $1 OR cr.requester_id = $1)
       AND fr.id IS NULL
     ORDER BY cr.reviewed_at DESC NULLS LAST, cr.created_at DESC`,
    [viewer.id]
  );
  json(res, 200, { reviews: rows.map(row => pendingReviewFromRow(row, viewer)), tags: REVIEW_TAGS, issueTags: ISSUE_REVIEW_TAGS });
}

async function handle(req, res, pathname, method) {
  if (method === "GET" && pathname === "/api/me") {
    const viewer = await userFromRequest(req);
    if (!viewer) {
      json(res, 200, {
        user: null,
        guest: true,
        agreementVersion: AGREEMENT_VERSION,
        message: "游客模式仅可浏览物品，请登录后发布或查看联系方式"
      });
      return true;
    }
    const summaries = await trustSummariesForUsers([viewer.id]);
    json(res, 200, {
      user: publicUser(viewer, { trustSummary: summaries.get(viewer.id) || emptyTrustSummary() }),
      agreementVersion: AGREEMENT_VERSION
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/me/profile") {
    await updateProfile(req, res);
    return true;
  }

  if (method === "GET" && pathname === "/api/me/notifications") {
    const viewer = await userFromRequest(req);
    if (!viewer) {
      json(res, 200, { claimEmailEnabled: true });
      return true;
    }
    json(res, 200, { claimEmailEnabled: viewer.claim_email_enabled !== false });
    return true;
  }

  if (method === "GET" && pathname === "/api/me/expired-count") {
    await expiredCount(req, res);
    return true;
  }

  if (method === "PUT" && pathname === "/api/me/notifications") {
    const viewer = await userFromRequest(req);
    if (!viewer || !viewer.is_verified) {
      json(res, 401, { error: "AUTH_REQUIRED", message: "请先登录" });
      return true;
    }
    const input = await readBody(req);
    if (typeof input.claimEmailEnabled === "boolean") {
      await query("UPDATE users SET claim_email_enabled = $1 WHERE id = $2", [input.claimEmailEnabled, viewer.id]);
    }
    json(res, 200, { claimEmailEnabled: input.claimEmailEnabled !== false });
    return true;
  }

  if (method === "GET" && pathname === "/api/me/reviews/pending") {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    await listPendingReviews(req, res, viewer);
    return true;
  }

  // GET /api/me/items
  if (method === "GET" && pathname === "/api/me/items") {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    const { rows } = await query(
      `SELECT i.*, COALESCE(c.pending_claim_count, 0)::int AS pending_claim_count
       FROM items i
       LEFT JOIN (
         SELECT item_id, COUNT(*)::int AS pending_claim_count
         FROM claim_requests
         WHERE status = 'pending'
         GROUP BY item_id
       ) c ON c.item_id = i.id
       WHERE i.owner_id = $1 AND COALESCE(i.owner_hidden, false) = false
       ORDER BY i.created_at DESC`,
      [viewer.id]
    );
    const items = await attachOwnerTrustSummaries(rows.map(row => itemFromRow(row, viewer, { includeRoom: true })));
    if (items.length) {
      const pendingClaims = await query(
        `SELECT cr.*
         FROM claim_requests cr
         JOIN items i ON i.id = cr.item_id
         WHERE i.owner_id = $1 AND cr.status = 'pending'
         ORDER BY cr.created_at ASC`,
        [viewer.id]
      );
      const byItem = new Map();
      for (const claim of pendingClaims.rows) {
        if (!byItem.has(claim.item_id)) {
          byItem.set(claim.item_id, []);
        }
        byItem.get(claim.item_id).push(claimFromRow(claim));
      }
      for (const item of items) {
        item.claimRequests = byItem.get(item.id) || [];
        item.pendingClaimCount = item.claimRequests.length;
      }
    }
    json(res, 200, { items });
    return true;
  }

  // POST /api/me/items/:id/take-down
  const myItemTakeDownMatch = pathname.match(/^\/api\/me\/items\/([^/]+)\/take-down$/);
  if (method === "POST" && myItemTakeDownMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemTakeDownMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return true;
    }
    if (rows[0].owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能下架自己的物品" });
      return true;
    }
    if (!["online", "reviewing"].includes(rows[0].status)) {
      json(res, 409, { error: "INVALID_STATUS", message: "只能下架上架中或审核中的物品" });
      return true;
    }
    const updated = await query(
      "UPDATE items SET status = 'taken_down', reviewed_at = now() WHERE id = $1 RETURNING *",
      [myItemTakeDownMatch[1]]
    );
    const [item] = await attachOwnerTrustSummaries([itemFromRow(updated.rows[0], viewer, { includeRoom: true, includeContact: true })]);
    json(res, 200, { item, message: "物品已下架" });
    return true;
  }

  // POST /api/me/items/:id/delete
  const myItemDeleteMatch = pathname.match(/^\/api\/me\/items\/([^/]+)\/delete$/);
  if (method === "POST" && myItemDeleteMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemDeleteMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return true;
    }
    if (rows[0].owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能删除自己的物品" });
      return true;
    }
    if (rows[0].status === "online" || rows[0].status === "reviewing") {
      await query(
        "UPDATE items SET status = 'taken_down', owner_hidden = true, reviewed_at = now() WHERE id = $1",
        [myItemDeleteMatch[1]]
      );
    } else {
      await query(
        "UPDATE items SET owner_hidden = true WHERE id = $1",
        [myItemDeleteMatch[1]]
      );
    }
    json(res, 200, { message: "发布记录已删除。" });
    return true;
  }

  // GET /api/me/items/:id
  const myItemDetailMatch = pathname.match(/^\/api\/me\/items\/([^/]+)$/);
  if (method === "GET" && myItemDetailMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemDetailMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return true;
    }
    if (rows[0].owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能查看自己的物品详情" });
      return true;
    }
    const [item] = await attachOwnerTrustSummaries([itemFromRow(rows[0], viewer, { includeRoom: true, includeContact: true })]);
    const pendingClaims = await query(
      `SELECT *
       FROM claim_requests
       WHERE item_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [rows[0].id]
    );
    item.claimRequests = pendingClaims.rows.map(claimFromRow);
    item.pendingClaimCount = item.claimRequests.length;
    json(res, 200, { item });
    return true;
  }

  // PUT /api/me/items/:id
  if (method === "PUT" && myItemDetailMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemDetailMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return true;
    }
    const existing = rows[0];
    if (existing.owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能编辑自己的物品" });
      return true;
    }
    const input = await readBody(req);
    const title = String(input.title || existing.title).trim();
    const quantity = Number.isInteger(Number(input.quantity)) ? Number(input.quantity) : existing.quantity;
    const unit = String(input.unit || existing.unit).trim();
    const description = String(input.description ?? existing.description).trim();
    const expireDate = input.expireDate !== undefined ? String(input.expireDate).trim() : (existing.expire_date ? dateOnly(existing.expire_date) : "");
    const noExpiry = input.noExpiry !== undefined ? Boolean(input.noExpiry) : existing.no_expiry;
    const contactWechat = String(input.contactWechat ?? existing.contact_wechat).trim();
    const contactQq = String(input.contactQq ?? existing.contact_qq).trim();
    const imageUrls = input.imageUrls !== undefined ? normalizeImageUrls(input.imageUrls) : parsePgArray(existing.image_urls).slice(0, 3);
    if (!title) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "标题不能为空" });
      return true;
    }
    if (quantity <= 0) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "数量必须是正整数" });
      return true;
    }
    if (!contactWechat && !contactQq) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "微信或 QQ 至少填写一项" });
      return true;
    }
    if (existing.item_type === "medicine" && noExpiry) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "药品必须填写有效期，不能设置为长期有效" });
      return true;
    }
    if (!noExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "有效期格式必须是 YYYY-MM-DD" });
      return true;
    }
    const wasOnline = existing.status === "online";
    const nextStatus = wasOnline ? "reviewing" : existing.status;
    const previousImageUrls = parsePgArray(existing.image_urls).slice(0, 3);
    const updated = await query(
      `UPDATE items
       SET title = $1, quantity = $2, unit = $3, description = $4,
           expire_date = $5, no_expiry = $6, contact_wechat = $7, contact_qq = $8,
           image_urls = $9::text[], status = $10,
           reviewed_at = CASE WHEN $10 = 'reviewing' THEN NULL ELSE reviewed_at END,
           reject_reason = CASE WHEN $10 = 'reviewing' THEN NULL ELSE reject_reason END
       WHERE id = $11
       RETURNING *`,
      [title, quantity, unit, description, noExpiry ? null : expireDate, noExpiry, contactWechat, contactQq, imageUrls, nextStatus, existing.id]
    );
    const removedImageUrls = previousImageUrls.filter(url => !imageUrls.includes(url));
    for (const url of removedImageUrls) {
      await deleteLocalImageIfUnused(url);
    }
    json(res, 200, {
      item: (await attachOwnerTrustSummaries([itemFromRow(updated.rows[0], viewer, { includeRoom: true, includeContact: true })]))[0],
      message: wasOnline ? "物品已更新并重新提交审核" : "物品已更新"
    });
    return true;
  }

  return false;
}

module.exports = { handle };
