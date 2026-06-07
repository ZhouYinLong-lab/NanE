const http = require("http");
const crypto = require("crypto");
require("./env");
const {
  DEMO_USER_ID,
  hashPassword,
  initializeDatabase,
  makeId,
  query
} = require("./db");
const { proximityForItem, sortByProximity } = require("./proximity");

const PORT = Number(process.env.PORT || 37878);
const JWT_SECRET = process.env.JWT_SECRET || "nane-dev-secret";
const DAILY_CONTACT_LIMIT = 5;
const ITEM_TYPES = {
  consumable: {
    text: "耗材",
    defaultCategory: "应急耗材",
    defaultIcon: "plus",
    categories: ["应急耗材", "退烧降温", "消毒护理", "外伤处理", "防护用品", "其他耗材"]
  },
  medicine: {
    text: "非处方药品",
    defaultCategory: "感冒药",
    defaultIcon: "capsules",
    categories: ["感冒药", "退烧药", "过敏药", "肠胃药", "其他非处方药"]
  }
};
const ALLOWED_ITEM_ICONS = new Set([
  "plus",
  "bandage",
  "notesMedical",
  "kitMedical",
  "capsules",
  "pills",
  "tablets",
  "prescriptionBottleMedical",
  "temperatureHalf",
  "maskFace",
  "shieldVirus",
  "pumpMedical",
  "bottleDroplet",
  "box",
  "boxOpen",
  "droplet",
  "handHoldingMedical",
  "heartPulse",
  "syringe",
  "soap"
]);

function defaultItemIcon(itemType) {
  return ITEM_TYPES[itemType]?.defaultIcon || ITEM_TYPES.consumable.defaultIcon;
}

function normalizeItemIcon(input, itemType) {
  const value = String(input || "").trim();
  return ALLOWED_ITEM_ICONS.has(value) ? value : defaultItemIcon(itemType);
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  });
  res.end(JSON.stringify(payload));
}

function html(res, body) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: Date.now() }));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, body, signature] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (signature.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (error) {
    return null;
  }
}

function adminFromRequest(req) {
  const auth = req.headers.authorization || "";
  return verifyToken(auth.replace(/^Bearer\s+/i, ""));
}

function dateOnly(value) {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function itemFromRow(row, viewer, options = {}) {
  const includeContact = Boolean(options.includeContact);
  const includeRoom = Boolean(options.includeRoom);
  const itemType = row.item_type || "consumable";
  const proximity = proximityForItem(row, viewer);

  return {
    id: row.id,
    title: row.title,
    itemType,
    itemTypeText: ITEM_TYPES[itemType]?.text || "耗材",
    itemIcon: row.item_icon || defaultItemIcon(itemType),
    category: row.category,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    campus: row.campus,
    building: row.building,
    room: includeRoom ? row.room || "" : undefined,
    expireDate: dateOnly(row.expire_date),
    status: row.status,
    rejectReason: row.reject_reason || "",
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    distanceScope: proximity.scope,
    distanceLabel: proximity.label,
    contact: includeContact
      ? {
          wechat: row.contact_wechat,
          qq: row.contact_qq
        }
      : undefined
  };
}

async function demoViewer() {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [DEMO_USER_ID]);
  return rows[0];
}

function validateItemInput(input) {
  const required = ["title", "itemType", "quantity", "unit", "campus", "building", "expireDate"];
  const missing = required.filter(key => input[key] === undefined || input[key] === "");
  if (missing.length) {
    return `缺少字段: ${missing.join(", ")}`;
  }
  const typeConfig = ITEM_TYPES[input.itemType];
  if (!typeConfig) {
    return "物品类型不在白名单内";
  }
  const category = String(input.category || typeConfig.defaultCategory).trim();
  if (!typeConfig.categories.includes(category)) {
    return "分类与物品类型不匹配";
  }
  if (input.itemIcon && !ALLOWED_ITEM_ICONS.has(String(input.itemIcon).trim())) {
    return "图标不在白名单内";
  }
  if (!Number.isInteger(Number(input.quantity)) || Number(input.quantity) <= 0) {
    return "数量必须是正整数";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.expireDate))) {
    return "有效期格式必须是 YYYY-MM-DD";
  }
  if (input.disclaimerAccepted !== true) {
    return "发布前必须确认免费互助与禁止处方药/管控药声明";
  }
  return "";
}

async function listItems(req, res, viewer) {
  const url = new URL(req.url, "http://localhost");
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const itemType = (url.searchParams.get("itemType") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();
  const status = url.searchParams.get("status") || "online";

  const clauses = [];
  const params = [];
  if (status !== "all") {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (itemType) {
    params.push(itemType);
    clauses.push(`item_type = $${params.length}`);
  }
  if (category && category !== "全部") {
    params.push(category);
    clauses.push(`category = $${params.length}`);
  }
  if (keyword) {
    params.push(`%${keyword}%`);
    clauses.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length} OR category ILIKE $${params.length} OR item_type ILIKE $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM items ${where}
     ORDER BY created_at DESC`,
    params
  );
  const sortedRows = sortByProximity(rows, viewer);

  json(res, 200, {
    items: sortedRows.map(row => itemFromRow(row, viewer)),
    viewer: {
      campus: viewer.campus,
      building: viewer.building
    }
  });
}

async function createItem(req, res, viewer) {
  const input = await readBody(req);
  const validationError = validateItemInput(input);
  if (validationError) {
    json(res, 400, { error: "VALIDATION_ERROR", message: validationError });
    return;
  }
  const contactWechat = String(input.contactWechat || "").trim();
  const contactQq = String(input.contactQq || "").trim();
  if (!contactWechat && !contactQq) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "微信或 QQ 至少填写一项" });
    return;
  }

  const itemId = makeId("item");
  const typeConfig = ITEM_TYPES[input.itemType] || ITEM_TYPES.consumable;
  const category = String(input.category || typeConfig.defaultCategory).trim();
  const itemIcon = normalizeItemIcon(input.itemIcon, input.itemType);
  const { rows } = await query(
    `INSERT INTO items (
      id, title, item_type, item_icon, category, description, quantity, unit, campus, building, room,
      expire_date, status, owner_id, owner_name, contact_wechat, contact_qq
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'reviewing', $13, $14, $15, $16)
    RETURNING *`,
    [
      itemId,
      String(input.title).trim(),
      input.itemType,
      itemIcon,
      category,
      String(input.description || "发布者暂未填写补充说明。").trim(),
      Number(input.quantity),
      String(input.unit).trim(),
      String(input.campus).trim(),
      String(input.building).trim(),
      String(input.room || "").trim() || null,
      input.expireDate,
      viewer.id,
      viewer.name,
      contactWechat,
      contactQq
    ]
  );

  json(res, 201, {
    item: itemFromRow(rows[0], viewer, { includeRoom: true }),
    message: "已提交审核，审核通过后会进入首页列表"
  });
}

async function viewContact(req, res, viewer, itemId) {
  const { rows } = await query("SELECT * FROM items WHERE id = $1", [itemId]);
  const item = rows[0];
  if (!item) {
    json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
    return;
  }
  if (item.status !== "online") {
    json(res, 409, { error: "ITEM_NOT_ONLINE", message: "该物品尚未上架，无法查看联系方式" });
    return;
  }

  const used = await query(
    "SELECT COUNT(*)::int AS count FROM contact_views WHERE viewer_id = $1 AND view_date = CURRENT_DATE",
    [viewer.id]
  );
  if (used.rows[0].count >= DAILY_CONTACT_LIMIT) {
    json(res, 429, { error: "CONTACT_LIMIT", message: "今日查看联系方式次数已用完" });
    return;
  }

  await query(
    "INSERT INTO contact_views (id, viewer_id, item_id) VALUES ($1, $2, $3)",
    [makeId("view"), viewer.id, item.id]
  );

  json(res, 200, {
    contact: {
      wechat: item.contact_wechat,
      qq: item.contact_qq
    },
    remaining: Math.max(DAILY_CONTACT_LIMIT - used.rows[0].count - 1, 0)
  });
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

async function requireAdmin(req, res) {
  const admin = adminFromRequest(req);
  if (!admin || admin.role !== "admin") {
    json(res, 401, { error: "UNAUTHORIZED", message: "请先登录管理员后台" });
    return null;
  }
  return admin;
}

async function adminItems(req, res) {
  const url = new URL(req.url, "http://localhost");
  const status = url.searchParams.get("status") || "reviewing";
  const params = [];
  const where = status === "all" ? "" : "WHERE status = $1";
  if (status !== "all") {
    params.push(status);
  }
  const { rows } = await query(`SELECT * FROM items ${where} ORDER BY created_at DESC`, params);
  const viewer = await demoViewer();
  json(res, 200, { items: rows.map(row => itemFromRow(row, viewer, { includeContact: true, includeRoom: true })) });
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
  json(res, 200, { item: itemFromRow(rows[0], viewer, { includeContact: true, includeRoom: true }) });
}

async function adminStats(req, res) {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'reviewing')::int AS reviewing,
       COUNT(*) FILTER (WHERE status = 'online')::int AS online,
       COUNT(*) FILTER (WHERE status IN ('expired', 'taken_down'))::int AS offline,
       (SELECT COUNT(*)::int FROM contact_views WHERE view_date = CURRENT_DATE) AS contact_views_today
     FROM items`
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
    .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
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
      </div>
      <div class="card row">
        <select id="item-status" onchange="loadItems()">
          <option value="reviewing">待审核</option>
          <option value="online">上架中</option>
          <option value="rejected">已驳回</option>
          <option value="taken_down">已下架</option>
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
    }
    async function loadItems() {
      const container = byId("items");
      const statusValue = byId("item-status").value || "reviewing";
      try {
        const data = await api("/api/admin/items?status=" + encodeURIComponent(statusValue));
        container.innerHTML = data.items.map(item => '<div class="card item"><div><h3>' + escapeHtml(item.title) +
          ' <span class="pill">' + escapeHtml(item.status) + '</span></h3><p>' + escapeHtml(item.description) +
          '</p><p class="muted">图标 ' + escapeHtml(item.itemIcon) + ' · ' + escapeHtml(item.itemTypeText) + ' · ' + escapeHtml(item.category) + ' · ' + escapeHtml(item.campus) + ' · ' + escapeHtml(item.building) + (item.room ? ' · ' + escapeHtml(item.room) : '') +
          ' · 余 ' + escapeHtml(item.quantity) + escapeHtml(item.unit) + ' · 有效期 ' + escapeHtml(item.expireDate) +
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

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  const pathname = new URL(req.url, "http://localhost").pathname;
  const viewer = await demoViewer();

  if (req.method === "GET" && pathname === "/admin") {
    html(res, adminPage());
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    json(res, 200, { ok: true, name: "NanE API", version: "0.2.0", database: "postgresql", time: new Date().toISOString() });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/wx-login") {
    const input = await readBody(req);
    json(res, 200, { token: signToken({ sub: viewer.id, role: "user" }), user: viewer, loginMode: input.code ? "wx-code-demo" : "fallback-demo" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const used = await query("SELECT COUNT(*)::int AS count FROM contact_views WHERE viewer_id = $1 AND view_date = CURRENT_DATE", [viewer.id]);
    json(res, 200, {
      user: viewer,
      contactLimit: {
        daily: DAILY_CONTACT_LIMIT,
        used: used.rows[0].count,
        remaining: Math.max(DAILY_CONTACT_LIMIT - used.rows[0].count, 0)
      }
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me/items") {
    const { rows } = await query("SELECT * FROM items WHERE owner_id = $1 ORDER BY created_at DESC", [viewer.id]);
    json(res, 200, { items: rows.map(row => itemFromRow(row, viewer, { includeRoom: true })) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/items") {
    await listItems(req, res, viewer);
    return;
  }

  const itemDetailMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (req.method === "GET" && itemDetailMatch) {
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [itemDetailMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }
    json(res, 200, { item: itemFromRow(rows[0], viewer) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/items") {
    await createItem(req, res, viewer);
    return;
  }

  const contactMatch = pathname.match(/^\/api\/items\/([^/]+)\/contact$/);
  if (req.method === "POST" && contactMatch) {
    await viewContact(req, res, viewer, contactMatch[1]);
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    await adminLogin(req, res);
    return;
  }

  if (pathname.startsWith("/api/admin/")) {
    const admin = await requireAdmin(req, res);
    if (!admin) {
      return;
    }
    if (req.method === "GET" && pathname === "/api/admin/items") {
      await adminItems(req, res);
      return;
    }
    if (req.method === "GET" && pathname === "/api/admin/stats") {
      await adminStats(req, res);
      return;
    }
    const reviewMatch = pathname.match(/^\/api\/admin\/items\/([^/]+)\/(approve|reject|take-down)$/);
    if (req.method === "POST" && reviewMatch) {
      await reviewItem(req, res, reviewMatch[1], reviewMatch[2].replace("take-down", "take_down"));
      return;
    }
  }

  json(res, 404, { error: "NOT_FOUND", message: "接口不存在" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(error);
    json(res, 500, { error: "SERVER_ERROR", message: error.message });
  });
});

initializeDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`NanE API listening on http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error("Failed to initialize NanE database:", error.stack || error.message || error);
    process.exit(1);
  });
