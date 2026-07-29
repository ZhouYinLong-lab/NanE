const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/nane";
// SECURITY: ADMIN_PASSWORD must be set via environment variable in production.
// The server will refuse to start with the hardcoded fallback.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (() => {
  console.error("FATAL: ADMIN_PASSWORD environment variable is not set. The server will not start.");
  console.error("Set ADMIN_PASSWORD in your .env file or environment before starting.");
  process.exit(1);
})();
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

async function enableOptionalTrigramIndexes() {
  try {
    await query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await query("CREATE INDEX IF NOT EXISTS idx_items_title_trgm ON items USING gin (title gin_trgm_ops)");
    await query("CREATE INDEX IF NOT EXISTS idx_items_description_trgm ON items USING gin (description gin_trgm_ops)");
  } catch (error) {
    console.warn(
      `[db] pg_trgm indexes skipped: ${error.message || error}. Keyword search will continue with ILIKE.`
    );
  }
}

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS room TEXT");
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'consumable'");
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS item_icon TEXT NOT NULL DEFAULT 'plus'");
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[]");
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS no_expiry BOOLEAN NOT NULL DEFAULT false");
  await query("ALTER TABLE items ADD COLUMN IF NOT EXISTS owner_hidden BOOLEAN NOT NULL DEFAULT false");
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
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT");
  await query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'moderator', 'viewer'))");
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
  await query("ALTER TABLE claim_requests DROP CONSTRAINT IF EXISTS claim_requests_status_check");
  await query("ALTER TABLE claim_requests ADD CONSTRAINT claim_requests_status_check CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled'))");
  await query("CREATE INDEX IF NOT EXISTS idx_claim_requests_item_status ON claim_requests(item_id, status, created_at DESC)");
  await query("CREATE INDEX IF NOT EXISTS idx_claim_requests_requester ON claim_requests(requester_id, created_at DESC)");
  await query(
    `CREATE TABLE IF NOT EXISTS fulfillment_reviews (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL REFERENCES claim_requests(id),
      item_id TEXT NOT NULL REFERENCES items(id),
      reviewer_id TEXT NOT NULL REFERENCES users(id),
      reviewee_id TEXT NOT NULL REFERENCES users(id),
      reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('owner', 'requester')),
      outcome TEXT NOT NULL DEFAULT 'positive' CHECK (outcome IN ('positive', 'issue')),
      tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );
  await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillment_reviews_claim_reviewer ON fulfillment_reviews(claim_id, reviewer_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_fulfillment_reviews_reviewee ON fulfillment_reviews(reviewee_id, created_at DESC)");
  await query("CREATE INDEX IF NOT EXISTS idx_fulfillment_reviews_item ON fulfillment_reviews(item_id, created_at DESC)");
  await query("ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_type_check");
  await query("ALTER TABLE items ADD CONSTRAINT items_item_type_check CHECK (item_type IN ('consumable', 'medicine', 'tool'))");
  await query(
    `DELETE FROM contact_views
     WHERE id IN (
       SELECT id
       FROM (
         SELECT id,
                row_number() OVER (
                  PARTITION BY viewer_id, item_id, view_date
                  ORDER BY viewed_at DESC, id DESC
                ) AS rn
         FROM contact_views
       ) ranked
       WHERE rn > 1
     )`
  );
  await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_views_unique ON contact_views(viewer_id, item_id, view_date)");
  await enableOptionalTrigramIndexes();
  await query("CREATE INDEX IF NOT EXISTS idx_items_status_expiry ON items(status, no_expiry, expire_date)");
  // Web Push subscriptions
  await query(
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, endpoint)
    )`
  );
  await query("CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)");
  // Item reports
  await query(
    `CREATE TABLE IF NOT EXISTS item_reports (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      reporter_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at TIMESTAMPTZ
    )`
  );

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

  // Seeds upserted on every startup — ON CONFLICT DO UPDATE ensures idempotency
  const seeds = [
    // --- Consumables (online) ---
    {
      id: "seed_c01", title: "碘伏棉签 10 支", itemType: "consumable", itemIcon: "pumpMedical",
      category: "消毒护理", description: "开学囤多了，独立包装未拆封，适合处理小伤口。",
      quantity: 10, unit: "支", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: "2026-12-31", status: "online", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_c02", title: "创可贴 8 片", itemType: "consumable", itemIcon: "bandage",
      category: "外伤处理", description: "普通透气款，剩余 8 片，同楼栋可自取。",
      quantity: 8, unit: "片", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: "2027-01-20", status: "online", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_c03", title: "退烧贴 3 片", itemType: "consumable", itemIcon: "temperatureHalf",
      category: "退烧降温", description: "未拆封，夜间应急优先。",
      quantity: 3, unit: "片", campus: "仙林校区", building: "南苑 B 栋", room: "301",
      expireDate: "2026-08-15", status: "online", ownerName: "林同学", wechat: "lin_help", qq: "987654321"
    },
    {
      id: "seed_c04", title: "N95 口罩 20 只", itemType: "consumable", itemIcon: "maskFace",
      category: "防护用品", description: "独立包装 N95，未开封，同楼栋自取。",
      quantity: 20, unit: "只", campus: "仙林校区", building: "南苑 C 栋", room: "",
      expireDate: "2028-06-01", status: "online", ownerName: "王同学", wechat: "wang_n95", qq: ""
    },
    {
      id: "seed_c05", title: "酒精湿巾 1 盒", itemType: "consumable", itemIcon: "soap",
      category: "消毒护理", description: "全新未拆，80 抽/盒，可用于日常消毒。",
      quantity: 1, unit: "盒", campus: "苏州校区", building: "独墅湖 1 号楼", room: "512",
      expireDate: "2026-11-01", status: "online", ownerName: "赵同学", wechat: "zhao_sz", qq: ""
    },
    {
      id: "seed_c06", title: "纱布绷带 5 卷", itemType: "consumable", itemIcon: "notesMedical",
      category: "外伤处理", description: "医用无菌纱布绷带，独立包装 ×5，适合应急包扎。",
      quantity: 5, unit: "卷", campus: "浦口校区", building: "浦苑 3 号楼", room: "",
      expireDate: "2027-07-01", status: "online", ownerName: "张同学", wechat: "", qq: "5555666677"
    },
    // --- Consumables (no expiry / long-term) ---
    {
      id: "seed_c07", title: "急救包 1 套", itemType: "consumable", itemIcon: "kitMedical",
      category: "应急耗材", description: "含创可贴、纱布、碘伏棉签、剪刀，全新未用。",
      quantity: 1, unit: "套", campus: "仙林校区", building: "南苑 A 栋", room: "208",
      expireDate: null, noExpiry: true, status: "online", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_c08", title: "体温计 1 支", itemType: "consumable", itemIcon: "temperatureHalf",
      category: "其他耗材", description: "电子体温计，用不上转赠，功能正常。",
      quantity: 1, unit: "支", campus: "仙林校区", building: "南苑 D 栋", room: "",
      expireDate: null, noExpiry: true, status: "online", ownerName: "陈同学", wechat: "chen_temp", qq: ""
    },
    // --- Medicines (online) ---
    {
      id: "seed_m01", title: "感冒灵颗粒 1 盒", itemType: "medicine", itemIcon: "capsules",
      category: "感冒药", description: "未拆封，有效期充足，同楼栋优先。",
      quantity: 1, unit: "盒", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: "2027-03-15", status: "online", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_m02", title: "布洛芬 1 盒", itemType: "medicine", itemIcon: "pills",
      category: "退烧药", description: "布洛芬缓释胶囊，全新未拆，数量有限请按需领取。",
      quantity: 1, unit: "盒", campus: "仙林校区", building: "南苑 B 栋", room: "117",
      expireDate: "2027-06-01", status: "online", ownerName: "李同学", wechat: "li_buluo", qq: ""
    },
    {
      id: "seed_m03", title: "氯雷他定片 1 盒", itemType: "medicine", itemIcon: "tablets",
      category: "过敏药", description: "季节性过敏备用，未拆封。",
      quantity: 1, unit: "盒", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: "2027-01-10", status: "online", ownerName: "孙同学", wechat: "sun_allergy", qq: "1111222233"
    },
    {
      id: "seed_m04", title: "蒙脱石散 3 袋", itemType: "medicine", itemIcon: "prescriptionBottleMedical",
      category: "肠胃药", description: "蒙脱石散 3g/袋 ×3，应急止泻，未拆封。",
      quantity: 3, unit: "袋", campus: "苏州校区", building: "独墅湖 2 号楼", room: "",
      expireDate: "2026-09-30", status: "online", ownerName: "赵同学", wechat: "zhao_sz", qq: ""
    },
    {
      id: "seed_m05", title: "西瓜霜含片 1 盒", itemType: "medicine", itemIcon: "bottleDroplet",
      category: "其他非处方药", description: "全新，咽喉不适可备用。",
      quantity: 1, unit: "盒", campus: "浦口校区", building: "浦苑 1 号楼", room: "305",
      expireDate: "2027-04-01", status: "online", ownerName: "张同学", wechat: "", qq: "5555666677"
    },
    // --- Tools (online) ---
    {
      id: "seed_t01", title: "十字螺丝刀 1 把", itemType: "tool", itemIcon: "box",
      category: "常用工具", description: "普通十字螺丝刀，偶尔借用，需归还。",
      quantity: 1, unit: "把", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: null, noExpiry: true, status: "online", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_t02", title: "打气筒 1 个", itemType: "tool", itemIcon: "boxOpen",
      category: "常用工具", description: "自行车打气筒，美嘴/法嘴通用，借用到楼栋大厅。",
      quantity: 1, unit: "个", campus: "仙林校区", building: "南苑 C 栋", room: "",
      expireDate: null, noExpiry: true, status: "online", ownerName: "王同学", wechat: "wang_n95", qq: ""
    },
    {
      id: "seed_t03", title: "小剪刀 1 把", itemType: "tool", itemIcon: "handHoldingMedical",
      category: "手工工具", description: "不锈钢小剪刀，可用于裁剪纱布等，借用。",
      quantity: 1, unit: "把", campus: "苏州校区", building: "独墅湖 1 号楼", room: "",
      expireDate: null, noExpiry: true, status: "online", ownerName: "赵同学", wechat: "zhao_sz", qq: ""
    },
    // --- Various statuses ---
    {
      id: "seed_r01", title: "阿莫西林 1 盒", itemType: "medicine", itemIcon: "capsules",
      category: "感冒药", description: "本发布违反规则，将出现在驳回列表作为示范。",
      quantity: 1, unit: "盒", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: "2026-10-01", status: "rejected", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_r02", title: "口罩 50 只（审核中）", itemType: "consumable", itemIcon: "shieldVirus",
      category: "防护用品", description: "等待管理员审核。",
      quantity: 50, unit: "只", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: "2028-01-01", status: "reviewing", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_r03", title: "过期的退烧药 1 盒", itemType: "medicine", itemIcon: "pills",
      category: "退烧药", description: "已过有效期，系统自动标记为过期，仅作展示参考。",
      quantity: 1, unit: "盒", campus: "仙林校区", building: "南苑 B 栋", room: "",
      expireDate: "2025-01-01", status: "online", ownerName: "林同学", wechat: "lin_help", qq: ""
    },
    {
      id: "seed_r04", title: "已被领取的感冒冲剂", itemType: "medicine", itemIcon: "capsules",
      category: "感冒药", description: "已被同学领取，查看 claimed 状态表现。",
      quantity: 1, unit: "盒", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: "2027-01-01", status: "claimed", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    {
      id: "seed_r05", title: "已下架的扳手", itemType: "tool", itemIcon: "box",
      category: "维修工具", description: "已主动下架，不再公开展示。",
      quantity: 1, unit: "把", campus: "仙林校区", building: "南苑 A 栋", room: "",
      expireDate: null, noExpiry: true, status: "taken_down", ownerName: "周同学", wechat: "nane_demo", qq: "123456789"
    },
    // --- Edge cases ---
    {
      id: "seed_e01", title: "驱蚊液 1 瓶", itemType: "consumable", itemIcon: "droplet",
      category: "防护用品", description: "",
      quantity: 1, unit: "瓶", campus: "仙林校区", building: "南苑 E 栋", room: "",
      expireDate: "2027-08-01", status: "online", ownerName: "郑同学", wechat: "zheng_mos", qq: ""
    },
    {
      id: "seed_e02", title: "维 C 泡腾片 1 管", itemType: "medicine", itemIcon: "tablets",
      category: "其他非处方药", description: "补充维生素，仅限自取，早八前可联系。",
      quantity: 1, unit: "管", campus: "苏州校区", building: "独墅湖 3 号楼", room: "220",
      expireDate: "2027-12-31", status: "online", ownerName: "吴同学", wechat: "wu_vc", qq: ""
    },
    {
      id: "seed_e03", title: "轮椅借用 1 台", itemType: "tool", itemIcon: "heartPulse",
      category: "其他工具", description: "脚踝扭伤时购入，现已恢复，可长期借用。需到楼栋大厅自取。",
      quantity: 1, unit: "台", campus: "浦口校区", building: "浦苑 2 号楼", room: "",
      expireDate: null, noExpiry: true, status: "online", ownerName: "胡同学", wechat: "hu_wheel", qq: ""
    },
    {
      id: "seed_e04", title: "医用棉签 100 支", itemType: "consumable", itemIcon: "plus",
      category: "应急耗材", description: "超大包医用棉签，可分装赠送，每人限领 20 支。",
      quantity: 100, unit: "支", campus: "仙林校区", building: "南苑 A 栋", room: "330",
      expireDate: "2027-06-15", status: "online", ownerName: "周同学", wechat: "nane_demo", qq: ""
    }
  ];

  console.log(`[seed] inserting ${seeds.length} seed items...`);
  for (const item of seeds) {
    try {
    await query(
      `INSERT INTO items (
        id, title, item_type, item_icon, category, description, quantity, unit, campus, building, room,
        expire_date, no_expiry, status, owner_id, owner_name, contact_wechat, contact_qq, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, item_type = EXCLUDED.item_type, item_icon = EXCLUDED.item_icon,
        category = EXCLUDED.category, description = EXCLUDED.description, quantity = EXCLUDED.quantity,
        unit = EXCLUDED.unit, campus = EXCLUDED.campus, building = EXCLUDED.building, room = EXCLUDED.room,
        expire_date = EXCLUDED.expire_date, no_expiry = EXCLUDED.no_expiry, status = EXCLUDED.status,
        owner_name = EXCLUDED.owner_name, contact_wechat = EXCLUDED.contact_wechat, contact_qq = EXCLUDED.contact_qq`,
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
        item.noExpiry || false,
        item.status,
        DEMO_USER_ID,
        item.ownerName,
        item.wechat,
        item.qq
      ]
    );
    } catch (e) {
      console.error(`[seed] failed to insert ${item.id}: ${e.message}`);
    }
  }
  console.log(`[seed] done.`);
}

module.exports = {
  DEMO_USER_ID,
  hashPassword,
  initializeDatabase,
  makeId,
  query
};
