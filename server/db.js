const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/nane";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "nane-admin-demo";
const DEMO_USER_ID = "u_demo";

const pool = new Pool({
  connectionString: DATABASE_URL
});

function hashPassword(password) {
  return crypto.createHash("sha256").update(`nane:${password}`).digest("hex");
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS room TEXT");

  await query(
    `INSERT INTO users (id, name, campus, building, wechat, qq, openid)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [DEMO_USER_ID, "周同学", "仙林校区", "南苑 A 栋", "nane_demo", "123456789", "demo-openid"]
  );

  await query(
    `INSERT INTO admins (id, username, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO NOTHING`,
    ["admin_demo", "admin", hashPassword(ADMIN_PASSWORD)]
  );

  const { rows } = await query("SELECT COUNT(*)::int AS count FROM items");
  if (rows[0].count > 0) {
    return;
  }

  const seeds = [
    {
      id: "item_iodine",
      title: "碘伏棉签 10 支",
      category: "消毒护理",
      description: "开学囤多了，独立包装未拆封，适合处理小伤口。",
      quantity: 10,
      unit: "支",
      campus: "仙林校区",
      building: "南苑 A 栋",
      room: "",
      expireDate: "2026-12-31",
      status: "online",
      ownerName: "周同学",
      wechat: "nane_demo",
      qq: "123456789"
    },
    {
      id: "item_patch",
      title: "创可贴 8 片",
      category: "外伤处理",
      description: "普通透气款，剩余 8 片，同楼栋可自取。",
      quantity: 8,
      unit: "片",
      campus: "仙林校区",
      building: "南苑 A 栋",
      room: "",
      expireDate: "2027-01-20",
      status: "online",
      ownerName: "周同学",
      wechat: "nane_demo",
      qq: "123456789"
    },
    {
      id: "item_cooling",
      title: "退烧贴 3 片",
      category: "退烧降温",
      description: "未拆封，夜间应急优先。",
      quantity: 3,
      unit: "片",
      campus: "仙林校区",
      building: "南苑 B 栋",
      room: "",
      expireDate: "2026-08-15",
      status: "online",
      ownerName: "林同学",
      wechat: "lin_help",
      qq: "987654321"
    }
  ];

  for (const item of seeds) {
    await query(
      `INSERT INTO items (
        id, title, category, description, quantity, unit, campus, building, room,
        expire_date, status, owner_id, owner_name, contact_wechat, contact_qq, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())`,
      [
        item.id,
        item.title,
        item.category,
        item.description,
        item.quantity,
        item.unit,
        item.campus,
        item.building,
        item.room,
        item.expireDate,
        item.status,
        DEMO_USER_ID,
        item.ownerName,
        item.wechat,
        item.qq
      ]
    );
  }
}

module.exports = {
  DEMO_USER_ID,
  hashPassword,
  initializeDatabase,
  makeId,
  query
};
