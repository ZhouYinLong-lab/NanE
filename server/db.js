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
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'consumable'");
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS item_icon TEXT NOT NULL DEFAULT 'plus'");
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS no_expiry BOOLEAN NOT NULL DEFAULT false");
  await query("ALTER TABLE items ALTER COLUMN expire_date DROP NOT NULL");
  await query("ALTER TABLE items DROP CONSTRAINT IF EXISTS items_quantity_check");
  await query("ALTER TABLE items ADD CONSTRAINT items_quantity_check CHECK (quantity >= 0)");
  await query("ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check");
  await query(
    "ALTER TABLE items ADD CONSTRAINT items_status_check CHECK (status IN ('reviewing', 'online', 'rejected', 'expired', 'taken_down', 'claimed'))"
  );
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'demo'");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_masked TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS major TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS room TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_version TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS claim_email_enabled BOOLEAN NOT NULL DEFAULT true");
  await query(
    `CREATE TABLE IF NOT EXISTS email_challenges (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );
  await query("CREATE INDEX IF NOT EXISTS idx_email_challenges_email_created ON email_challenges(email, created_at DESC)");
  await query(
    `CREATE TABLE IF NOT EXISTS claim_requests (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      requester_id TEXT NOT NULL REFERENCES users(id),
      requester_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at TIMESTAMPTZ
    )`
  );
  await query("ALTER TABLE claim_requests ALTER COLUMN status SET DEFAULT 'pending'");
  await query("CREATE INDEX IF NOT EXISTS idx_claim_requests_item_status ON claim_requests(item_id, status, created_at DESC)");
  await query("CREATE INDEX IF NOT EXISTS idx_claim_requests_requester ON claim_requests(requester_id, created_at DESC)");
  await query("ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_type_check");
  await query("ALTER TABLE items ADD CONSTRAINT items_item_type_check CHECK (item_type IN ('consumable', 'medicine', 'tool'))");

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
      itemType: "consumable",
      itemIcon: "pumpMedical",
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
      itemType: "consumable",
      itemIcon: "bandage",
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
      itemType: "consumable",
      itemIcon: "temperatureHalf",
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
        id, title, item_type, item_icon, category, description, quantity, unit, campus, building, room,
        expire_date, status, owner_id, owner_name, contact_wechat, contact_qq, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())`,
      [
        item.id,
        item.title,
        item.itemType,
        item.itemIcon,
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
