const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const tls = require("tls");
require("./env");
const {
  DEMO_USER_ID,
  hashPassword,
  initializeDatabase,
  makeId,
  query
} = require("./db");
const { proximityForItem, sortByProximity } = require("./proximity");
const locations = require("../miniprogram/data/locations");

const PORT = Number(process.env.PORT || 37878);
const JWT_SECRET = process.env.JWT_SECRET || (() => { console.warn("WARNING: JWT_SECRET not set, using dev fallback — do NOT use in production"); return "nane-dev-secret"; })();
const NANNA_API_BASE = String(process.env.NANNA_API_BASE || "").replace(/\/+$/, "");
const NANNA_APP_UID = process.env.NANNA_APP_UID || "";
const NANNA_API_KEY = process.env.NANNA_API_KEY || "";
const NANNA_SCOPES = ["identity:basic:read", "identity:student_id:read", "identity:campus:read", "identity:major:read"];
const DAILY_CONTACT_LIMIT = 5;
const AGREEMENT_VERSION = "v1.0";
const DEBUG_MODE = String(process.env.DEBUG_MODE || "false").toLowerCase() === "true";
const TEST_USER_IDS = ["u_demo"];
const NJU_STUDENT_EMAIL_SUFFIX = "@smail.nju.edu.cn";
const EMAIL_CODE_TTL_MINUTES = 5;
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const PUBLIC_WEB_URL = String(process.env.PUBLIC_WEB_URL || "https://nane.zylatent.com").replace(/\/+$/, "");
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
  },
  tool: {
    text: "工具",
    defaultCategory: "常用工具",
    defaultIcon: "box",
    categories: ["常用工具", "维修工具", "手工工具", "清洁工具", "其他工具"]
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
const NICKNAME_ADJECTIVES = ["热心", "快乐", "靠谱", "温柔", "元气", "清醒", "友善", "机灵", "真诚", "阳光", "安静", "勇敢"];
const NICKNAME_NOUNS = ["小蓝鲸", "小猫", "同学", "室友", "小南瓜", "小紫薯", "小云朵", "小星星", "小书包", "小梧桐", "小灯塔", "小雨伞"];

function defaultItemIcon(itemType) {
  return ITEM_TYPES[itemType]?.defaultIcon || ITEM_TYPES.consumable.defaultIcon;
}

function normalizeItemIcon(input, itemType) {
  const value = String(input || "").trim();
  return ALLOWED_ITEM_ICONS.has(value) ? value : defaultItemIcon(itemType);
}

// In-memory rate limiting for password login: email → {attempts, lockedUntil}
const loginAttempts = new Map();
function recordFailedLogin(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key) || { attempts: 0, lockedUntil: 0 };
  rec.attempts += 1;
  if (rec.attempts >= 5) {
    rec.lockedUntil = now + 15 * 60 * 1000;
  }
  loginAttempts.set(key, rec);
}

function randomNickname() {
  const adjective = NICKNAME_ADJECTIVES[crypto.randomInt(0, NICKNAME_ADJECTIVES.length)];
  const noun = NICKNAME_NOUNS[crypto.randomInt(0, NICKNAME_NOUNS.length)];
  return `${adjective}${noun}`;
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

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
  });
  fs.createReadStream(filePath).pipe(res);
}

function staticPathFromRequest(pathname) {
  if (pathname === "/" || pathname === "/web") {
    return path.join(__dirname, "..", "web", "index.html");
  }
  if (pathname.startsWith("/web/")) {
    const relative = pathname.replace(/^\/web\//, "");
    return path.join(__dirname, "..", "web", relative);
  }
  if (pathname.startsWith("/assets/")) {
    const relative = pathname.replace(/^\/assets\//, "");
    return path.join(__dirname, "..", "miniprogram", "assets", relative);
  }
  return "";
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET") {
    return false;
  }
  const filePath = staticPathFromRequest(pathname);
  if (!filePath) {
    return false;
  }
  const roots = [
    path.join(__dirname, "..", "web"),
    path.join(__dirname, "..", "miniprogram", "assets")
  ].map(root => path.resolve(root));
  const resolved = path.resolve(filePath);
  const allowed = roots.some(root => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  if (!allowed || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    json(res, 404, { error: "NOT_FOUND", message: "静态资源不存在" });
    return true;
  }
  sendFile(res, resolved);
  return true;
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
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + 60 * 60 * 24 * 30 }));
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

function agreementAccepted(input) {
  return input?.agreementAccepted === true && String(input.agreementVersion || AGREEMENT_VERSION) === AGREEMENT_VERSION;
}

function userHasAgreement(user) {
  return Boolean(user?.agreement_accepted_at && user?.agreement_version === AGREEMENT_VERSION);
}

function userProfileComplete(user) {
  return Boolean(user?.name && user?.campus && user?.building && user.building !== "未设置楼栋");
}

function publicUser(user) {
  if (!user) {
    return null;
  }
  const {
    password_hash: passwordHash,
    password_salt: passwordSalt,
    ...safeUser
  } = user;
  return {
    ...safeUser,
    hasAgreement: userHasAgreement(user),
    profileComplete: userProfileComplete(user),
    agreementVersion: user.agreement_version || "",
    hasPassword: Boolean(passwordHash)
  };
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
    noExpiry: Boolean(row.no_expiry),
    status: row.status,
    rejectReason: row.reject_reason || "",
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    pendingClaimCount: Number(row.pending_claim_count || 0),
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

async function userFromRequest(req) {
  const auth = req.headers.authorization || "";
  const payload = verifyToken(auth.replace(/^Bearer\s+/i, ""));
  if (payload?.role === "user" && payload.sub) {
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
    if (rows[0]) {
      return rows[0];
    }
  }
  return null;
}

async function viewerFromRequest(req) {
  return (await userFromRequest(req)) || demoViewer();
}

function locationExists(campusName, buildingName, roomName = "") {
  const campus = locations.find(item => item.name === campusName);
  if (!campus) {
    return false;
  }
  const building = (campus.buildings || []).find(item => item.name === buildingName);
  if (!building) {
    return false;
  }
  if (!roomName) {
    return true;
  }
  return (building.rooms || []).includes(roomName);
}

async function requireVerifiedUser(req, res) {
  const user = await userFromRequest(req);
  if (!user || !user.is_verified) {
    json(res, 401, { error: "AUTH_REQUIRED", message: "请先登录或使用南哪小帮手完成校园身份验证" });
    return null;
  }
  if (!userHasAgreement(user)) {
    json(res, 403, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return null;
  }
  if (!userProfileComplete(user)) {
    json(res, 403, { error: "PROFILE_REQUIRED", message: "请先在“我的”页设置昵称、校区和楼栋" });
    return null;
  }
  return user;
}

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

function nannaConfigured() {
  return Boolean(NANNA_API_BASE && NANNA_APP_UID && NANNA_API_KEY);
}

function pick(source, keys, fallback = "") {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return fallback;
}

function nannaHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${NANNA_API_KEY}`
  };
}

function smtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

function dotStuff(value) {
  return String(value).replace(/^\./gm, "..");
}

function parseAddress(input) {
  const value = String(input || "").trim();
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return {
      header: value,
      address: value
    };
  }
  const name = match[1].trim();
  const address = match[2].trim();
  return {
    header: `${encodeHeader(name)} <${address}>`,
    address
  };
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function smtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = chunk => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const last = lines[lines.length - 1];
      if (/^\d{3} /.test(last)) {
        socket.off("data", onData);
        const code = Number(last.slice(0, 3));
        if (code >= 400) {
          reject(new Error(last));
          return;
        }
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

async function smtpCommand(socket, command) {
  socket.write(`${command}\r\n`);
  return smtpResponse(socket);
}

async function sendMail({ to, subject, text, html }) {
  if (!smtpConfigured()) {
    throw new Error("服务器尚未配置 SMTP 发信参数");
  }
  const from = parseAddress(SMTP_FROM);
  const socket = tls.connect({
    host: SMTP_HOST,
    port: SMTP_PORT,
    servername: SMTP_HOST,
    rejectUnauthorized: SMTP_SECURE
  });
  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });
  try {
    await smtpResponse(socket);
    await smtpCommand(socket, `EHLO ${SMTP_HOST}`);
    await smtpCommand(socket, "AUTH LOGIN");
    await smtpCommand(socket, Buffer.from(SMTP_USER).toString("base64"));
    await smtpCommand(socket, Buffer.from(SMTP_PASS).toString("base64"));
    await smtpCommand(socket, `MAIL FROM:<${SMTP_USER}>`);
    await smtpCommand(socket, `RCPT TO:<${to}>`);
    await smtpCommand(socket, "DATA");
    const boundary = `nane-${crypto.randomBytes(8).toString("hex")}`;
    const parts = [
      `From: ${from.header}`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0"
    ];
    if (html) {
      parts.push(
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(text),
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(html),
        `--${boundary}--`
      );
    } else {
      parts.push(
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(text)
      );
    }
    const message = `${parts.join("\r\n")}\r\n.`;
    await smtpCommand(socket, message);
    await smtpCommand(socket, "QUIT");
  } finally {
    socket.end();
  }
}

async function sendClaimNotificationMail(ownerEmail, item, claim) {
  if (!ownerEmail) {
    return false;
  }
  const requesterName = claim.requesterName || "有同学";
  const claimQty = claim.quantity || 1;
  const claimUnit = item.unit || "件";
  const link = `${PUBLIC_WEB_URL}?view=mine&focus=claims`;
  const safeRequesterName = escapeHtml(requesterName);
  const safeItemTitle = escapeHtml(item.title);
  const safeClaimQty = escapeHtml(claimQty);
  const safeClaimUnit = escapeHtml(claimUnit);
  const safeCampus = escapeHtml(item.campus);
  const safeBuilding = escapeHtml(item.building);
  const safeLink = escapeHtml(link);
  try {
    await sendMail({
      to: ownerEmail,
      subject: "NanE 南易领取确认提醒",
      text: [
        `${requesterName} 提醒你：TA 已联系并领取了你发布的物品。`,
        "",
        `物品：${item.title}`,
        `领取数量：${claimQty}${claimUnit}`,
        `位置：${item.campus} · ${item.building}`,
        "",
        "请点击下方链接登录 NanE，在「我的发布」中确认领取或忽略该提醒。",
        link,
        "",
        "确认后系统会自动扣减剩余数量；如果数量扣到 0，物品会自动下架。",
        "如果你们尚未完成领取，可以先忽略这封邮件。"
      ].join("\n"),
      html: [
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head><meta charset="utf-8"></head>',
        '<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">',
        `  <p style="font-size:16px;line-height:1.6">${safeRequesterName} 提醒你：<strong>TA 已联系并领取了你发布的物品</strong>。</p>`,
        '  <table style="width:100%;border-collapse:collapse;margin:18px 0;background:#fffaf2;border:1px solid #e4ded3;border-radius:12px">',
        `    <tr><td style="padding:10px 16px;font-weight:700;color:#6f6a61">物品</td><td style="padding:10px 16px">${safeItemTitle}</td></tr>`,
        `    <tr><td style="padding:10px 16px;font-weight:700;color:#6f6a61">领取数量</td><td style="padding:10px 16px">${safeClaimQty}${safeClaimUnit}</td></tr>`,
        `    <tr><td style="padding:10px 16px;font-weight:700;color:#6f6a61">位置</td><td style="padding:10px 16px">${safeCampus} · ${safeBuilding}</td></tr>`,
        '  </table>',
        `  <a href="${safeLink}" style="display:inline-block;padding:14px 32px;background:#6E0065;color:#fffaf2;border-radius:999px;font-weight:900;text-decoration:none;font-size:16px;margin:12px 0">去 NanE 确认领取</a>`,
        '  <p style="color:#6f6a61;font-size:14px;line-height:1.6;margin-top:20px">确认后系统会自动扣减剩余数量；如果数量扣到 0，物品会自动下架。<br>如果你们尚未完成领取，可以先忽略这封邮件。</p>',
        `  <p style="color:#a09b91;font-size:12px;margin-top:16px">如果按钮无法点击，请复制以下链接到浏览器：<br>${safeLink}</p>`,
        '</body>',
        '</html>'
      ].join("\n")
    });
    return true;
  } catch (error) {
    console.error("Claim notification email failed:", error.message);
    return false;
  }
}

async function callNanna(pathname, payload) {
  const response = await fetch(`${NANNA_API_BASE}${pathname}`, {
    method: "POST",
    headers: nannaHeaders(),
    body: JSON.stringify({
      app_uid: NANNA_APP_UID,
      appUid: NANNA_APP_UID,
      scopes: NANNA_SCOPES,
      scope: NANNA_SCOPES.join(" "),
      ...payload
    })
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message = data.message || data.error_description || data.error || "南哪小帮手接口请求失败";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

function normalizeNannaIdentity(data, input = {}) {
  const profile = data.user || data.profile || data.identity || data.data || data;
  const openid = String(pick(profile, ["openid", "openId", "open_id", "sub", "id"], "")).trim();
  const email = String(pick(profile, ["email"], input.email || "")).trim();
  const studentId = String(pick(profile, ["student_id", "studentId", "studentID"], input.studentId || "")).trim();
  const campus = String(pick(profile, ["campus", "campus_name", "campusName"], "仙林校区")).trim();
  const building = String(pick(profile, ["building", "building_name", "buildingName", "dormitory"], "未设置楼栋")).trim();
  return {
    openid,
    name: String(pick(profile, ["name", "nickname", "display_name", "displayName"], "南易用户")).trim(),
    campus,
    building,
    email,
    studentIdMasked: studentId ? `${studentId.slice(0, 3)}****${studentId.slice(-2)}` : "",
    major: String(pick(profile, ["major", "department"], "")).trim()
  };
}

async function upsertNannaUser(identity, agreementVersion = AGREEMENT_VERSION) {
  if (!identity.openid) {
    throw new Error("南哪小帮手未返回 openid，无法建立 NanE 账号");
  }
  const userId = makeId("user");
  const { rows } = await query(
    `INSERT INTO users (
      id, name, campus, building, wechat, qq, openid, auth_provider, email, student_id_masked, major, is_verified,
      agreement_version, agreement_accepted_at
    )
    VALUES ($1, $2, $3, $4, '', '', $5, 'nanna', $6, $7, $8, true, $9, now())
    ON CONFLICT (openid) DO UPDATE SET
      name = EXCLUDED.name,
      campus = EXCLUDED.campus,
      building = EXCLUDED.building,
      auth_provider = 'nanna',
      email = EXCLUDED.email,
      student_id_masked = EXCLUDED.student_id_masked,
      major = EXCLUDED.major,
      is_verified = true,
      agreement_version = EXCLUDED.agreement_version,
      agreement_accepted_at = EXCLUDED.agreement_accepted_at
    RETURNING *`,
    [
      userId,
      identity.name || "南易用户",
      identity.campus || "仙林校区",
      identity.building || "未设置楼栋",
      identity.openid,
      identity.email || null,
      identity.studentIdMasked || null,
      identity.major || null,
      agreementVersion
    ]
  );
  return rows[0];
}

function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function validateStudentEmail(email) {
  return email.endsWith(NJU_STUDENT_EMAIL_SUFFIX);
}

function hashEmailCode(email, code) {
  return crypto.createHash("sha256").update(`nane-email:${email}:${code}:${JWT_SECRET}`).digest("hex");
}

function makeEmailCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashUserPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 210000, 32, "sha256").toString("hex");
}

function makePasswordSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function validatePasswordStrength(password) {
  if (typeof password !== "string") {
    return "密码格式不正确";
  }
  if (password.length < 8) {
    return "密码至少需要 8 位";
  }
  if (password.length > 64) {
    return "密码最多 64 位";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "密码必须包含至少一个字母";
  }
  if (!/[0-9]/.test(password)) {
    return "密码必须包含至少一个数字";
  }
  return "";
}

async function setPassword(req, res) {
  const user = await userFromRequest(req);
  if (!user || !user.is_verified) {
    json(res, 401, { error: "AUTH_REQUIRED", message: "请先登录后再设置密码" });
    return;
  }
  const input = await readBody(req);
  const password = String(input.password || "");
  const validationError = validatePasswordStrength(password);
  if (validationError) {
    json(res, 400, { error: "VALIDATION_ERROR", message: validationError });
    return;
  }
  const salt = makePasswordSalt();
  const passwordHash = hashUserPassword(password, salt);
  await query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
    [passwordHash, salt, user.id]
  );
  json(res, 200, { message: "密码设置成功，下次可以使用邮箱和密码登录" });
}

async function passwordLogin(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  const password = String(input.password || "");
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  if (!password) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请输入密码" });
    return;
  }

  // Rate limit: check failed attempts
  const attemptKey = `pwd:${email}`;
  const now = Date.now();
  const record = loginAttempts.get(attemptKey);
  if (record && record.lockedUntil > now) {
    const waitMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    json(res, 429, { error: "LOGIN_RATE_LIMIT", message: `登录尝试次数过多，请 ${waitMinutes} 分钟后再试` });
    return;
  }

  const { rows } = await query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = true",
    [email]
  );
  const user = rows[0];
  if (!user || !user.password_hash || !user.password_salt) {
    recordFailedLogin(attemptKey);
    json(res, 401, { error: "INVALID_LOGIN", message: "账号或密码错误" });
    return;
  }
  const expectedHash = hashUserPassword(password, user.password_salt);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(user.password_hash, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    recordFailedLogin(attemptKey);
    json(res, 401, { error: "INVALID_LOGIN", message: "账号或密码错误" });
    return;
  }

  // Successful login clears failed attempts
  loginAttempts.delete(attemptKey);
  if (!user.agreement_version || user.agreement_version !== AGREEMENT_VERSION) {
    await query(
      "UPDATE users SET agreement_version = $1, agreement_accepted_at = now() WHERE id = $2",
      [AGREEMENT_VERSION, user.id]
    );
    user.agreement_version = AGREEMENT_VERSION;
    user.agreement_accepted_at = new Date().toISOString();
  }
  json(res, 200, {
    token: signToken({ sub: user.id, role: "user", provider: "password" }),
    user: publicUser(user),
    loginMode: "password"
  });
}

async function passwordResetChallenge(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  const { rows } = await query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = true",
    [email]
  );
  if (!rows[0]) {
    json(res, 200, { message: "如果该账号存在，验证码已发送至对应邮箱" });
    return;
  }
  if (!rows[0].password_hash) {
    json(res, 400, { error: "NO_PASSWORD", message: "该账号尚未设置密码，请使用邮箱验证码登录后设置密码" });
    return;
  }
  const recent = await query(
    "SELECT created_at FROM email_challenges WHERE email = $1 AND created_at > now() - interval '60 seconds' ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (recent.rows[0]) {
    json(res, 429, { error: "EMAIL_RATE_LIMIT", message: "验证码发送太频繁，请稍后再试" });
    return;
  }
  const code = makeEmailCode();
  const challengeId = makeId("email_challenge");
  await query(
    "INSERT INTO email_challenges (id, email, code_hash, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)",
    [challengeId, email, hashEmailCode(email, code), EMAIL_CODE_TTL_MINUTES]
  );
  await sendMail({
    to: email,
    subject: "NanE 南易密码重置验证码",
    text: [
      `你的 NanE 南易密码重置验证码是：${code}`,
      "",
      `验证码 ${EMAIL_CODE_TTL_MINUTES} 分钟内有效，请勿转发给他人。`,
      "如果这不是你本人操作，可以忽略这封邮件。"
    ].join("\n")
  });
  json(res, 200, {
    challengeId,
    expiresIn: EMAIL_CODE_TTL_MINUTES * 60,
    message: "验证码已发送至对应邮箱"
  });
}

async function passwordReset(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  const code = String(input.code || "").trim();
  const newPassword = String(input.password || "");
  const challengeId = String(input.challengeId || input.challenge_id || "").trim();
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写 6 位验证码" });
    return;
  }
  const validationError = validatePasswordStrength(newPassword);
  if (validationError) {
    json(res, 400, { error: "VALIDATION_ERROR", message: validationError });
    return;
  }
  const params = challengeId ? [challengeId, email] : [email];
  const sql = challengeId
    ? `SELECT * FROM email_challenges
       WHERE id = $1 AND email = $2 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM email_challenges
       WHERE email = $1 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`;
  const { rows } = await query(sql, params);
  const challenge = rows[0];
  if (!challenge || challenge.code_hash !== hashEmailCode(email, code)) {
    json(res, 400, { error: "INVALID_CODE", message: "验证码错误或已过期" });
    return;
  }
  await query("UPDATE email_challenges SET used_at = now() WHERE id = $1", [challenge.id]);
  const salt = makePasswordSalt();
  const passwordHash = hashUserPassword(newPassword, salt);
  const { rows: userRows } = await query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE email = $3 AND is_verified = true RETURNING *",
    [passwordHash, salt, email]
  );
  if (!userRows[0]) {
    json(res, 404, { error: "USER_NOT_FOUND", message: "账号不存在" });
    return;
  }
  json(res, 200, { message: "密码重置成功，请使用新密码登录" });
}

async function changePassword(req, res) {
  const user = await requireVerifiedUser(req, res);
  if (!user) {
    return;
  }
  const input = await readBody(req);
  const currentPassword = String(input.currentPassword || "");
  const newPassword = String(input.newPassword || "");
  const confirmPassword = String(input.confirmPassword || "");

  if (!user.password_hash || !user.password_salt) {
    json(res, 400, { error: "NO_PASSWORD", message: "请先通过邮箱验证码设置初始密码" });
    return;
  }
  if (!currentPassword) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请输入当前密码" });
    return;
  }
  const expectedHash = hashUserPassword(currentPassword, user.password_salt);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(user.password_hash, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    json(res, 400, { error: "WRONG_PASSWORD", message: "当前密码错误" });
    return;
  }
  const validationError = validatePasswordStrength(newPassword);
  if (validationError) {
    json(res, 400, { error: "VALIDATION_ERROR", message: validationError });
    return;
  }
  if (newPassword !== confirmPassword) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "两次输入的新密码不一致" });
    return;
  }
  const salt = makePasswordSalt();
  const passwordHash = hashUserPassword(newPassword, salt);
  await query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
    [passwordHash, salt, user.id]
  );
  json(res, 200, { message: "密码修改成功" });
}

async function emailChallenge(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  if (!email) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写南京大学学生邮箱" });
    return;
  }
  if (!validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }

  const recent = await query(
    "SELECT created_at FROM email_challenges WHERE email = $1 AND created_at > now() - interval '60 seconds' ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (recent.rows[0]) {
    json(res, 429, { error: "EMAIL_RATE_LIMIT", message: "验证码发送太频繁，请稍后再试" });
    return;
  }

  const code = makeEmailCode();
  const challengeId = makeId("email_challenge");
  await query(
    `INSERT INTO email_challenges (id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [challengeId, email, hashEmailCode(email, code), EMAIL_CODE_TTL_MINUTES]
  );
  await sendMail({
    to: email,
    subject: "NanE 南易登录验证码",
    text: [
      `你的 NanE 南易登录验证码是：${code}`,
      "",
      `验证码 ${EMAIL_CODE_TTL_MINUTES} 分钟内有效，请勿转发给他人。`,
      "如果这不是你本人操作，可以忽略这封邮件。"
    ].join("\n")
  });

  json(res, 200, {
    challengeId,
    expiresIn: EMAIL_CODE_TTL_MINUTES * 60,
    message: `验证码已发送至 ${email}`
  });
}

async function upsertEmailUser(email) {
  const userId = `email_${crypto.createHash("sha1").update(email).digest("hex").slice(0, 16)}`;
  const name = randomNickname();
  const { rows } = await query(
    `INSERT INTO users (
      id, name, campus, building, wechat, qq, openid, auth_provider, email, is_verified,
      agreement_version, agreement_accepted_at
    )
    VALUES ($1, $2, '仙林校区', '未设置楼栋', '', '', $3, 'email', $4, true, $5, now())
    ON CONFLICT (id) DO UPDATE SET
      name = CASE
        WHEN users.name = split_part(EXCLUDED.email, '@', 1) THEN EXCLUDED.name
        ELSE users.name
      END,
      auth_provider = 'email',
      email = EXCLUDED.email,
      is_verified = true,
      agreement_version = EXCLUDED.agreement_version,
      agreement_accepted_at = EXCLUDED.agreement_accepted_at
    RETURNING *`,
    [userId, name, `email:${email}`, email, AGREEMENT_VERSION]
  );
  return rows[0];
}

async function emailVerify(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  const code = String(input.code || "").trim();
  const challengeId = String(input.challengeId || input.challenge_id || "").trim();
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写 6 位邮箱验证码" });
    return;
  }
  const params = challengeId ? [challengeId, email] : [email];
  const sql = challengeId
    ? `SELECT * FROM email_challenges
       WHERE id = $1 AND email = $2 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM email_challenges
       WHERE email = $1 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`;
  const { rows } = await query(sql, params);
  const challenge = rows[0];
  if (!challenge || challenge.code_hash !== hashEmailCode(email, code)) {
    json(res, 400, { error: "INVALID_CODE", message: "验证码错误或已过期" });
    return;
  }
  await query("UPDATE email_challenges SET used_at = now() WHERE id = $1", [challenge.id]);
  const user = await upsertEmailUser(email);
  json(res, 200, {
    token: signToken({ sub: user.id, role: "user", provider: "email" }),
    user: publicUser(user),
    loginMode: "email"
  });
}

async function nannaChallenge(req, res) {
  if (!nannaConfigured()) {
    json(res, 503, { error: "NANNA_NOT_CONFIGURED", message: "服务器尚未配置南哪小帮手身份验证参数" });
    return;
  }
  const input = await readBody(req);
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  const email = String(input.email || "").trim();
  const studentId = String(input.studentId || input.student_id || "").trim();
  if (!email && !studentId) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写邮箱或学号以接收验证码" });
    return;
  }
  const data = await callNanna("/api/v1/oauth/challenge", {
    email: email || undefined,
    student_id: studentId || undefined,
    studentId: studentId || undefined
  });
  json(res, 200, {
    challengeId: pick(data, ["challenge_id", "challengeId", "id"], ""),
    maskedTarget: pick(data, ["masked_target", "maskedTarget", "target"], email || studentId),
    expiresIn: pick(data, ["expires_in", "expiresIn"], 300),
    message: data.message || "验证码已通过南哪小帮手发送"
  });
}

async function nannaVerify(req, res) {
  if (!nannaConfigured()) {
    json(res, 503, { error: "NANNA_NOT_CONFIGURED", message: "服务器尚未配置南哪小帮手身份验证参数" });
    return;
  }
  const input = await readBody(req);
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  const code = String(input.code || input.challengeCode || "").trim();
  const challengeId = String(input.challengeId || input.challenge_id || "").trim();
  if (!code) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写南哪小帮手验证码" });
    return;
  }
  const data = await callNanna("/api/v1/oauth/verify", {
    challenge_id: challengeId || undefined,
    challengeId: challengeId || undefined,
    code,
    challenge_code: code,
    email: String(input.email || "").trim() || undefined,
    student_id: String(input.studentId || input.student_id || "").trim() || undefined
  });
  const identity = normalizeNannaIdentity(data, input);
  const user = await upsertNannaUser(identity, AGREEMENT_VERSION);
  json(res, 200, {
    token: signToken({ sub: user.id, role: "user", provider: "nanna" }),
    user: publicUser(user),
    loginMode: "nanna"
  });
}

function validateItemInput(input) {
  const required = ["title", "itemType", "quantity", "unit", "campus", "building"];
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
  const noExpiry = input.noExpiry === true;
  if (input.itemType === "medicine" && noExpiry) {
    return "药品必须填写有效期，不能设置为长期有效";
  }
  if (!noExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.expireDate))) {
    return "有效期格式必须是 YYYY-MM-DD";
  }
  if (!noExpiry && String(input.expireDate) <= new Date().toISOString().slice(0, 10)) {
    return "有效期不能早于明天，请修改后重新提交";
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
  const reqDebug = url.searchParams.get("debug") === "true";

  await query("UPDATE items SET status = 'expired' WHERE status = 'online' AND no_expiry = false AND expire_date < CURRENT_DATE");

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
  if (!DEBUG_MODE && !reqDebug) {
    clauses.push(`owner_id NOT IN ('u_demo')`);
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
  const noExpiry = input.noExpiry === true && (input.itemType === "consumable" || input.itemType === "tool");
  const { rows } = await query(
    `INSERT INTO items (
      id, title, item_type, item_icon, category, description, quantity, unit, campus, building, room,
      expire_date, no_expiry, status, owner_id, owner_name, contact_wechat, contact_qq
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'reviewing', $14, $15, $16, $17)
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
      noExpiry ? null : input.expireDate,
      noExpiry,
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

  const already = await query(
    "SELECT id FROM contact_views WHERE viewer_id = $1 AND item_id = $2 AND view_date = CURRENT_DATE LIMIT 1",
    [viewer.id, item.id]
  );
  if (already.rows[0]) {
    const used = await query(
      "SELECT COUNT(DISTINCT item_id)::int AS count FROM contact_views WHERE viewer_id = $1 AND view_date = CURRENT_DATE",
      [viewer.id]
    );
    json(res, 200, {
      contact: {
        wechat: item.contact_wechat,
        qq: item.contact_qq
      },
      remaining: Math.max(DAILY_CONTACT_LIMIT - used.rows[0].count, 0),
      alreadyViewed: true,
      countedThisTime: false
    });
    return;
  }

  const used = await query(
    "SELECT COUNT(DISTINCT item_id)::int AS count FROM contact_views WHERE viewer_id = $1 AND view_date = CURRENT_DATE",
    [viewer.id]
  );
  if (used.rows[0].count >= DAILY_CONTACT_LIMIT) {
    json(res, 429, { error: "CONTACT_LIMIT", message: "今日查看联系方式次数已用完" });
    return;
  }

  const inserted = await query(
    `INSERT INTO contact_views (id, viewer_id, item_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (viewer_id, item_id, view_date) DO NOTHING
     RETURNING id`,
    [makeId("view"), viewer.id, item.id]
  );
  if (!inserted.rows[0]) {
    const currentUsed = await query(
      "SELECT COUNT(DISTINCT item_id)::int AS count FROM contact_views WHERE viewer_id = $1 AND view_date = CURRENT_DATE",
      [viewer.id]
    );
    json(res, 200, {
      contact: {
        wechat: item.contact_wechat,
        qq: item.contact_qq
      },
      remaining: Math.max(DAILY_CONTACT_LIMIT - currentUsed.rows[0].count, 0),
      alreadyViewed: true,
      countedThisTime: false
    });
    return;
  }

  json(res, 200, {
    contact: {
      wechat: item.contact_wechat,
      qq: item.contact_qq
    },
    remaining: Math.max(DAILY_CONTACT_LIMIT - used.rows[0].count - 1, 0),
    alreadyViewed: false,
    countedThisTime: true
  });
}

function claimFromRow(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    quantity: row.quantity,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

async function requestClaim(req, res, viewer, itemId) {
  const input = await readBody(req);
  const quantity = Math.max(1, Number(input.quantity || 1));
  if (!Number.isInteger(quantity)) {
    json(res, 400, { error: "INVALID_QUANTITY", message: "领取数量必须是正整数" });
    return;
  }

  const { rows } = await query(
    `SELECT i.*, u.email AS owner_email, COALESCE(u.claim_email_enabled, true) AS owner_claim_email_enabled
     FROM items i
     LEFT JOIN users u ON u.id = i.owner_id
     WHERE i.id = $1`,
    [itemId]
  );
  const item = rows[0];
  if (!item) {
    json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
    return;
  }
  if (item.status !== "online") {
    json(res, 409, { error: "ITEM_NOT_ONLINE", message: "该物品当前不可领取" });
    return;
  }
  if (item.owner_id === viewer.id) {
    json(res, 400, { error: "OWNER_CANNOT_CLAIM", message: "不能领取自己发布的物品" });
    return;
  }
  if (quantity > item.quantity) {
    json(res, 400, { error: "QUANTITY_EXCEEDED", message: "领取数量不能超过当前剩余数量" });
    return;
  }

  const existing = await query(
    "SELECT * FROM claim_requests WHERE item_id = $1 AND requester_id = $2 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    [itemId, viewer.id]
  );
  if (existing.rows[0]) {
    json(res, 200, {
      claimRequest: claimFromRow(existing.rows[0]),
      message: "你已提醒过发布者确认领取，请等待对方处理"
    });
    return;
  }

  const created = await query(
    `INSERT INTO claim_requests (id, item_id, requester_id, requester_name, quantity, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [makeId("claim"), itemId, viewer.id, viewer.name, quantity]
  );
  const claimRequest = claimFromRow(created.rows[0]);
  const shouldSendEmail = item.owner_claim_email_enabled !== false;
  const emailSent = shouldSendEmail ? await sendClaimNotificationMail(item.owner_email, item, claimRequest) : false;
  json(res, 201, {
    claimRequest,
    emailSent,
    message: emailSent
      ? "已通过邮件提醒发布者确认领取，确认后会自动更新库存"
      : "已记录领取提醒；发布者可在“我的发布”中确认领取"
  });
}

async function reviewClaim(req, res, viewer, claimId, action) {
  const { rows } = await query(
    `SELECT cr.*, i.owner_id, i.quantity AS item_quantity, i.status AS item_status
     FROM claim_requests cr
     JOIN items i ON i.id = cr.item_id
     WHERE cr.id = $1`,
    [claimId]
  );
  const claim = rows[0];
  if (!claim) {
    json(res, 404, { error: "CLAIM_NOT_FOUND", message: "领取提醒不存在" });
    return;
  }
  if (claim.owner_id !== viewer.id) {
    json(res, 403, { error: "FORBIDDEN", message: "只能处理自己发布物品的领取提醒" });
    return;
  }
  if (claim.status !== "pending") {
    json(res, 409, { error: "CLAIM_ALREADY_REVIEWED", message: "该领取提醒已经处理过" });
    return;
  }

  if (action === "reject") {
    const rejected = await query(
      "UPDATE claim_requests SET status = 'rejected', reviewed_at = now() WHERE id = $1 RETURNING *",
      [claimId]
    );
    json(res, 200, { claimRequest: claimFromRow(rejected.rows[0]), message: "已忽略该领取提醒" });
    return;
  }

  if (claim.item_status !== "online") {
    json(res, 409, { error: "ITEM_NOT_ONLINE", message: "该物品已不在上架状态，无法确认领取" });
    return;
  }

  const claimedQuantity = Math.min(Number(claim.quantity), Number(claim.item_quantity));
  const nextStatus = claimedQuantity >= Number(claim.item_quantity) ? "claimed" : "online";
  const reviewed = await query(
    "UPDATE claim_requests SET status = 'confirmed', reviewed_at = now() WHERE id = $1 RETURNING *",
    [claimId]
  );
  const item = await query(
    `UPDATE items
     SET quantity = GREATEST(quantity - $1, 0),
         status = CASE WHEN quantity - $1 <= 0 THEN 'claimed' ELSE 'online' END,
         reviewed_at = CASE WHEN quantity - $1 <= 0 THEN now() ELSE reviewed_at END
     WHERE id = $2 AND quantity >= $1
     RETURNING *`,
    [claimedQuantity, claim.item_id]
  );
  if (!item.rows[0]) {
    json(res, 409, { error: "INSUFFICIENT_QUANTITY", message: "物品数量不足，已被其他人领取" });
    return;
  }

  const updatedItem = item.rows[0];
  json(res, 200, {
    claimRequest: claimFromRow(reviewed.rows[0]),
    item: itemFromRow(updatedItem, viewer, { includeRoom: true }),
    message: updatedItem.status === "claimed" ? "已确认领取，物品已自动下架" : `已确认领取，剩余 ${updatedItem.quantity}${updatedItem.unit}`
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
  const testFilter = !DEBUG_MODE ? "WHERE owner_id NOT IN ('u_demo')" : "";
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'reviewing')::int AS reviewing,
       COUNT(*) FILTER (WHERE status = 'online')::int AS online,
       COUNT(*) FILTER (WHERE status IN ('expired', 'taken_down', 'claimed'))::int AS offline,
       (SELECT COUNT(*)::int FROM contact_views WHERE view_date = CURRENT_DATE) AS contact_views_today
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

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  const pathname = new URL(req.url, "http://localhost").pathname;

  if (req.method === "GET" && pathname === "/admin") {
    html(res, adminPage());
    return;
  }

  if (serveStatic(req, res, pathname)) {
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    json(res, 200, { ok: true, name: "NanE API", version: "0.2.0", database: "postgresql", time: new Date().toISOString() });
    return;
  }

  if (req.method === "GET" && pathname === "/api/legal/agreement") {
    const markdown = fs.readFileSync(path.join(__dirname, "..", "docs", "user-agreement.md"), "utf8");
    json(res, 200, { version: AGREEMENT_VERSION, markdown });
    return;
  }

  if (req.method === "GET" && pathname === "/api/legal/privacy") {
    const privacyPath = path.join(__dirname, "..", "docs", "privacy-guideline-draft.md");
    const markdown = fs.existsSync(privacyPath)
      ? fs.readFileSync(privacyPath, "utf8")
      : "隐私保护指引暂不可用。";
    json(res, 200, { markdown });
    return;
  }

  if (req.method === "GET" && pathname === "/api/locations") {
    json(res, 200, { locations });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/wx-login") {
    const viewer = await demoViewer();
    const input = await readBody(req);
    json(res, 200, { token: signToken({ sub: viewer.id, role: "user" }), user: publicUser(viewer), loginMode: input.code ? "wx-code-demo" : "fallback-demo" });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/email-login") {
    json(res, 410, { error: "ENDPOINT_DEPRECATED", message: "请使用邮箱验证码登录接口" });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/email/challenge") {
    await emailChallenge(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/email/verify") {
    await emailVerify(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/password/set") {
    await setPassword(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/password/login") {
    await passwordLogin(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/password/reset-challenge") {
    await passwordResetChallenge(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/password/reset") {
    await passwordReset(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/password/change") {
    await changePassword(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/nanna/challenge") {
    await nannaChallenge(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/nanna/verify") {
    await nannaVerify(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const viewer = await userFromRequest(req);
    if (!viewer) {
      json(res, 200, {
        user: null,
        contactLimit: {
          daily: DAILY_CONTACT_LIMIT,
          used: 0,
          remaining: 0
        },
        guest: true,
        agreementVersion: AGREEMENT_VERSION,
        message: "游客模式仅可浏览物品，请登录后发布或查看联系方式"
      });
      return;
    }
    const used = await query("SELECT COUNT(*)::int AS count FROM contact_views WHERE viewer_id = $1 AND view_date = CURRENT_DATE", [viewer.id]);
    json(res, 200, {
      user: publicUser(viewer),
      agreementVersion: AGREEMENT_VERSION,
      contactLimit: {
        daily: DAILY_CONTACT_LIMIT,
        used: used.rows[0].count,
        remaining: Math.max(DAILY_CONTACT_LIMIT - used.rows[0].count, 0)
      }
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/me/profile") {
    await updateProfile(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/me/notifications") {
    const viewer = await userFromRequest(req);
    if (!viewer) {
      json(res, 200, { claimEmailEnabled: true });
      return;
    }
    json(res, 200, { claimEmailEnabled: viewer.claim_email_enabled !== false });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me/expired-count") {
    await expiredCount(req, res);
    return;
  }

  if (req.method === "PUT" && pathname === "/api/me/notifications") {
    const viewer = await userFromRequest(req);
    if (!viewer || !viewer.is_verified) {
      json(res, 401, { error: "AUTH_REQUIRED", message: "请先登录" });
      return;
    }
    const input = await readBody(req);
    if (typeof input.claimEmailEnabled === "boolean") {
      await query("UPDATE users SET claim_email_enabled = $1 WHERE id = $2", [input.claimEmailEnabled, viewer.id]);
    }
    json(res, 200, { claimEmailEnabled: input.claimEmailEnabled !== false });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me/items") {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) {
      return;
    }
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
    const items = rows.map(row => itemFromRow(row, viewer, { includeRoom: true }));
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
    return;
  }

  const myItemTakeDownMatch = pathname.match(/^\/api\/me\/items\/([^/]+)\/take-down$/);
  if (req.method === "POST" && myItemTakeDownMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemTakeDownMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }
    if (rows[0].owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能下架自己的物品" });
      return;
    }
    if (!["online", "reviewing"].includes(rows[0].status)) {
      json(res, 409, { error: "INVALID_STATUS", message: "只能下架上架中或审核中的物品" });
      return;
    }
    const updated = await query(
      "UPDATE items SET status = 'taken_down', reviewed_at = now() WHERE id = $1 RETURNING *",
      [myItemTakeDownMatch[1]]
    );
    json(res, 200, { item: itemFromRow(updated.rows[0], viewer, { includeRoom: true, includeContact: true }), message: "物品已下架" });
    return;
  }

  const myItemDeleteMatch = pathname.match(/^\/api\/me\/items\/([^/]+)\/delete$/);
  if (req.method === "POST" && myItemDeleteMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemDeleteMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }
    if (rows[0].owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能删除自己的物品" });
      return;
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
    return;
  }

  const myItemDetailMatch = pathname.match(/^\/api\/me\/items\/([^/]+)$/);
  if (req.method === "GET" && myItemDetailMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemDetailMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }
    if (rows[0].owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能查看自己的物品详情" });
      return;
    }
    const item = itemFromRow(rows[0], viewer, { includeRoom: true, includeContact: true });
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
    return;
  }

  if (req.method === "PUT" && myItemDetailMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return;
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [myItemDetailMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }
    const existing = rows[0];
    if (existing.owner_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能编辑自己的物品" });
      return;
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
    if (!title) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "标题不能为空" });
      return;
    }
    if (quantity <= 0) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "数量必须是正整数" });
      return;
    }
    if (!contactWechat && !contactQq) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "微信或 QQ 至少填写一项" });
      return;
    }
    if (existing.item_type === "medicine" && noExpiry) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "药品必须填写有效期，不能设置为长期有效" });
      return;
    }
    if (!noExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) {
      json(res, 400, { error: "VALIDATION_ERROR", message: "有效期格式必须是 YYYY-MM-DD" });
      return;
    }
    const wasOnline = existing.status === "online";
    const nextStatus = wasOnline ? "reviewing" : existing.status;
    const updated = await query(
      `UPDATE items
       SET title = $1, quantity = $2, unit = $3, description = $4,
           expire_date = $5, no_expiry = $6, contact_wechat = $7, contact_qq = $8,
           status = $9, reviewed_at = CASE WHEN $9 = 'reviewing' THEN NULL ELSE reviewed_at END,
           reject_reason = CASE WHEN $9 = 'reviewing' THEN NULL ELSE reject_reason END
       WHERE id = $10
       RETURNING *`,
      [title, quantity, unit, description, noExpiry ? null : expireDate, noExpiry, contactWechat, contactQq, nextStatus, existing.id]
    );
    json(res, 200, {
      item: itemFromRow(updated.rows[0], viewer, { includeRoom: true, includeContact: true }),
      message: wasOnline ? "物品已更新并重新提交审核" : "物品已更新"
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/items") {
    const viewer = await viewerFromRequest(req);
    await listItems(req, res, viewer);
    return;
  }

  const itemDetailMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (req.method === "GET" && itemDetailMatch) {
    const viewer = await viewerFromRequest(req);
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [itemDetailMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }
    json(res, 200, { item: itemFromRow(rows[0], viewer) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/items") {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) {
      return;
    }
    await createItem(req, res, viewer);
    return;
  }

  const contactMatch = pathname.match(/^\/api\/items\/([^/]+)\/contact$/);
  if (req.method === "POST" && contactMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) {
      return;
    }
    await viewContact(req, res, viewer, contactMatch[1]);
    return;
  }

  const claimMatch = pathname.match(/^\/api\/items\/([^/]+)\/claim$/);
  if (req.method === "POST" && claimMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) {
      return;
    }
    await requestClaim(req, res, viewer, claimMatch[1]);
    return;
  }

  const claimReviewMatch = pathname.match(/^\/api\/claims\/([^/]+)\/(confirm|reject)$/);
  if (req.method === "POST" && claimReviewMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) {
      return;
    }
    await reviewClaim(req, res, viewer, claimReviewMatch[1], claimReviewMatch[2]);
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
    json(res, 500, { error: "SERVER_ERROR", message: "服务器内部错误，请稍后重试" });
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
