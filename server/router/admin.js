/**
 * Admin router — admin login, item review, stats, and the admin console HTML page.
 */
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
    token: signToken({ sub: admin.id, role: "admin", username: admin.username })
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
        WHERE true ${claimFilter}) AS fulfillment_reviews
     FROM items ${testFilter}`
  );
  json(res, 200, rows[0]);
}

function adminPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NanE 管理后台</title>
  <style>
    body{margin:0;background:#f5f3ed;color:#1f2a24;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{padding:24px 32px;background:#173f32;color:#fff}
    main{max-width:1100px;margin:0 auto;padding:24px}
    .card{background:#fff;border:1px solid #e5ded2;border-radius:10px;padding:18px;margin-bottom:16px}
    input,select,textarea{border:1px solid #d9d0c3;border-radius:8px;padding:10px;font-size:14px}
    button{border:0;border-radius:8px;background:#25735a;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer}
    button.secondary{background:#8b6422}button.danger{background:#9f3d33}
    .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
    .stat strong{display:block;font-size:28px;color:#25735a}.item{display:grid;grid-template-columns:1fr auto;gap:14px}
    .muted{color:#6f7a72}.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#e7f5ed;color:#25735a;font-size:12px;font-weight:700}
    @media(max-width:760px){.stats{grid-template-columns:1fr 1fr}.item{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header><h1>NanE 南易管理后台</h1><div>审核校园互助信息，确保免费共享、人工审核、禁止处方药/管控药。</div></header>
  <main>
    <section class="card" id="login">
      <h2>管理员登录</h2>
      <div class="row">
        <input id="username" value="admin" placeholder="用户名">
        <input id="password" type="password" placeholder="密码">
        <button onclick="login()">登录</button>
      </div>
      <p class="muted">默认密码来自服务器环境变量 ADMIN_PASSWORD。</p>
    </section>
    <section id="dashboard" style="display:none">
      <div class="stats">
        <div class="card stat"><span>待审核</span><strong id="s-reviewing">0</strong></div>
        <div class="card stat"><span>上架中</span><strong id="s-online">0</strong></div>
        <div class="card stat"><span>已下架</span><strong id="s-offline">0</strong></div>
        <div class="card stat"><span>今日查看</span><strong id="s-contact">0</strong></div>
        <div class="card stat"><span>已履约</span><strong id="s-claims">0</strong></div>
        <div class="card stat"><span>履约评价</span><strong id="s-reviews">0</strong></div>
      </div>
      <div class="card row">
        <select id="item-status" onchange="loadItems()">
          <option value="reviewing">待审核</option>
          <option value="online">上架中</option>
          <option value="rejected">已驳回</option>
          <option value="taken_down">已下架</option>
          <option value="claimed">已领取</option>
          <option value="all">全部</option>
        </select>
        <button onclick="loadAll()">刷新</button>
      </div>
      <div id="items"></div>
    </section>
  </main>
  <script>
    let token = localStorage.getItem("nane_admin_token") || "";
    function byId(id) { return document.getElementById(id); }
    function escapeHtml(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function(char) {
        if (char === "&") return "&amp;";
        if (char === "<") return "&lt;";
        if (char === ">") return "&gt;";
        if (char === '"') return "&quot;";
        return "&#39;";
      });
    }
    async function api(path, options = {}) {
      const res = await fetch(path, {
        ...options,
        headers: {"Content-Type":"application/json", Authorization: "Bearer " + token, ...(options.headers || {})}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "请求失败");
      return data;
    }
    async function login() {
      try {
        const data = await api("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({username: byId("username").value, password: byId("password").value})
        });
        token = data.token;
        localStorage.setItem("nane_admin_token", token);
        byId("login").style.display = "none";
        byId("dashboard").style.display = "block";
        loadAll();
      } catch (error) { alert(error.message); }
    }
    async function loadAll(){ await Promise.all([loadStats(), loadItems()]); }
    async function loadStats() {
      const s = await api("/api/admin/stats");
      byId("s-reviewing").textContent = s.reviewing;
      byId("s-online").textContent = s.online;
      byId("s-offline").textContent = s.offline;
      byId("s-contact").textContent = s.contact_views_today;
      byId("s-claims").textContent = s.confirmed_claims;
      byId("s-reviews").textContent = s.fulfillment_reviews;
    }
    async function loadItems() {
      const container = byId("items");
      const statusValue = byId("item-status").value || "reviewing";
      try {
        const data = await api("/api/admin/items?status=" + encodeURIComponent(statusValue));
        container.innerHTML = data.items.map(item => '<div class="card item"><div><h3>' + escapeHtml(item.title) +
          ' <span class="pill">' + escapeHtml(item.status) + '</span></h3><p>' + escapeHtml(item.description) +
          '</p><p class="muted">图标 ' + escapeHtml(item.itemIcon) + ' · ' + escapeHtml(item.itemTypeText) + ' · ' + escapeHtml(item.category) + ' · ' + escapeHtml(item.campus) + ' · ' + escapeHtml(item.building) + (item.room ? ' · ' + escapeHtml(item.room) : '') +
          ' · 余 ' + escapeHtml(item.quantity) + escapeHtml(item.unit) + ' · 有效期 ' + escapeHtml(item.noExpiry ? "长期有效" : item.expireDate) +
          ' · 图片 ' + escapeHtml((item.imageUrls || []).length) + ' 张' +
          '</p><p class="muted">发布者：' + escapeHtml(item.ownerName) + ' · 微信 ' + escapeHtml(item.contact.wechat || "未填") + ' · QQ ' + escapeHtml(item.contact.qq || "未填") +
          (item.rejectReason ? '</p><p>驳回原因：' + escapeHtml(item.rejectReason) : '') +
          '</p></div><div class="row">' +
          '<button data-id="' + escapeHtml(item.id) + '" data-action="approve" onclick="reviewFromButton(this)">通过</button>' +
          '<button class="secondary" data-id="' + escapeHtml(item.id) + '" data-action="reject" onclick="reviewFromButton(this)">驳回</button>' +
          '<button class="danger" data-id="' + escapeHtml(item.id) + '" data-action="take-down" onclick="reviewFromButton(this)">下架</button>' +
          '</div></div>').join("") || '<div class="card muted">暂无数据</div>';
      } catch (error) {
        container.innerHTML = '<div class="card muted">列表加载失败：' + escapeHtml(error.message) + '</div>';
      }
    }
    function reviewFromButton(button) {
      review(button.dataset.id, button.dataset.action);
    }
    async function review(id, action) {
      const reason = action === "reject" ? prompt("请输入驳回原因", "不符合发布规范") : "";
      if (action === "reject" && reason === null) return;
      await api("/api/admin/items/" + id + "/" + action, {method:"POST", body: JSON.stringify({reason})});
      loadAll();
    }
    if (token) {
      byId("login").style.display = "none";
      byId("dashboard").style.display = "block";
      loadAll().catch(() => {});
    }
  </script>
</body>
</html>`;
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

  // All other /api/admin/* routes require admin authentication
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
