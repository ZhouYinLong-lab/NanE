/**
 * Items router — list, create, view detail, view contact.
 */
const { query, makeId, DEMO_USER_ID } = require("../db");
const { readBody, json } = require("../lib/util");
const { viewerFromRequest, requireVerifiedUser } = require("../middleware/auth");
const { sortByProximity, proximityForItem } = require("../proximity");
const { normalizeImageUrls, attachOwnerTrustSummaries, itemFromRow, ITEM_TYPES, ALLOWED_ITEM_ICONS, defaultItemIcon, normalizeItemIcon } = require("../lib/item-utils");
const { sendClaimNotificationMail } = require("../service/email");

const DEBUG_MODE = String(process.env.DEBUG_MODE || "false").toLowerCase() === "true";

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
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);

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
  const total = sortedRows.length;
  const paged = sortedRows.slice(offset, offset + limit);

  const items = await attachOwnerTrustSummaries(paged.map(row => itemFromRow(row, viewer)));
  json(res, 200, {
    items,
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
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
  const imageUrls = normalizeImageUrls(input.imageUrls);
  const noExpiry = input.noExpiry === true && (input.itemType === "consumable" || input.itemType === "tool");
  const { rows } = await query(
    `INSERT INTO items (
      id, title, item_type, item_icon, image_urls, category, description, quantity, unit, campus, building, room,
      expire_date, no_expiry, status, owner_id, owner_name, contact_wechat, contact_qq
    )
    VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, $12, $13, $14, 'reviewing', $15, $16, $17, $18)
    RETURNING *`,
    [
      itemId,
      String(input.title).trim(),
      input.itemType,
      itemIcon,
      imageUrls,
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

  const [item] = await attachOwnerTrustSummaries([itemFromRow(rows[0], viewer, { includeRoom: true })]);
  json(res, 201, {
    item,
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
    json(res, 200, {
      contact: { wechat: item.contact_wechat, qq: item.contact_qq },
      alreadyViewed: true,
      countedThisTime: false
    });
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
    json(res, 200, {
      contact: { wechat: item.contact_wechat, qq: item.contact_qq },
      alreadyViewed: true,
      countedThisTime: false
    });
    return;
  }

  json(res, 200, {
    contact: { wechat: item.contact_wechat, qq: item.contact_qq },
    alreadyViewed: false,
    countedThisTime: true
  });
}

async function handle(req, res, pathname, method) {
  if (method === "GET" && pathname === "/api/items") {
    const viewer = await viewerFromRequest(req);
    await listItems(req, res, viewer);
    return true;
  }

  const itemDetailMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (method === "GET" && itemDetailMatch) {
    const viewer = await viewerFromRequest(req);
    const { rows } = await query("SELECT * FROM items WHERE id = $1", [itemDetailMatch[1]]);
    if (!rows[0]) {
      json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return true;
    }
    const [item] = await attachOwnerTrustSummaries([itemFromRow(rows[0], viewer)]);
    json(res, 200, { item });
    return true;
  }

  if (method === "POST" && pathname === "/api/items") {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    await createItem(req, res, viewer);
    return true;
  }

  const contactMatch = pathname.match(/^\/api\/items\/([^/]+)\/contact$/);
  if (method === "POST" && contactMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    await viewContact(req, res, viewer, contactMatch[1]);
    return true;
  }

  return false;
}

module.exports = { handle };
