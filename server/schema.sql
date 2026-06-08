CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campus TEXT NOT NULL,
  building TEXT NOT NULL,
  wechat TEXT NOT NULL,
  qq TEXT NOT NULL,
  openid TEXT UNIQUE,
  auth_provider TEXT NOT NULL DEFAULT 'demo',
  email TEXT,
  student_id_masked TEXT,
  major TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  agreement_version TEXT,
  agreement_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'consumable' CHECK (item_type IN ('consumable', 'medicine')),
  item_icon TEXT NOT NULL DEFAULT 'plus',
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  campus TEXT NOT NULL,
  building TEXT NOT NULL,
  room TEXT,
  expire_date DATE,
  no_expiry BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('reviewing', 'online', 'rejected', 'expired', 'taken_down')),
  reject_reason TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  owner_name TEXT NOT NULL,
  contact_wechat TEXT NOT NULL,
  contact_qq TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS contact_views (
  id TEXT PRIMARY KEY,
  viewer_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'take_down')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_status_created ON items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_views_daily ON contact_views(viewer_id, view_date);
CREATE INDEX IF NOT EXISTS idx_review_logs_item ON review_logs(item_id, created_at DESC);
