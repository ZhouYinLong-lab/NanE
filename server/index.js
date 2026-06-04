const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "data", "db.json");
const DEMO_USER_ID = "u_demo";
const DAILY_CONTACT_LIMIT = 5;

function readDb() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
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

function publicItem(item, viewer) {
  const scope =
    item.building === viewer.building
      ? "same_building"
      : item.campus === viewer.campus
        ? "same_campus"
        : "other_campus";

  return {
    ...item,
    contact: undefined,
    distanceScope: scope,
    distanceLabel: scope === "same_building" ? "同楼栋优先" : scope === "same_campus" ? "同校区" : "跨校区"
  };
}

function sortForViewer(items, viewer) {
  const rank = { same_building: 0, same_campus: 1, other_campus: 2 };
  return [...items].sort((a, b) => {
    const pa = publicItem(a, viewer);
    const pb = publicItem(b, viewer);
    return rank[pa.distanceScope] - rank[pb.distanceScope] || new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function routePath(url) {
  return new URL(url, "http://localhost").pathname;
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  const pathname = routePath(req.url);
  const db = readDb();
  const viewer = db.users.find(user => user.id === DEMO_USER_ID) || db.users[0];

  if (req.method === "GET" && pathname === "/api/health") {
    send(res, 200, {
      ok: true,
      name: "NanE API",
      version: "0.1.0",
      time: new Date().toISOString()
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/wx-login") {
    const input = await readBody(req);
    send(res, 200, {
      token: "demo-token",
      user: viewer,
      loginMode: input.code ? "wx-code-demo" : "fallback-demo"
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const usedToday = db.contactViews.filter(view => view.viewerId === viewer.id && view.date === todayKey()).length;
    send(res, 200, {
      user: viewer,
      contactLimit: {
        daily: DAILY_CONTACT_LIMIT,
        used: usedToday,
        remaining: Math.max(DAILY_CONTACT_LIMIT - usedToday, 0)
      }
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me/items") {
    const mine = db.items
      .filter(item => item.ownerId === viewer.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(item => publicItem(item, viewer));
    send(res, 200, { items: mine });
    return;
  }

  if (req.method === "GET" && pathname === "/api/items") {
    const url = new URL(req.url, "http://localhost");
    const keyword = (url.searchParams.get("keyword") || "").trim().toLowerCase();
    const category = (url.searchParams.get("category") || "").trim();
    const status = url.searchParams.get("status") || "online";

    const filtered = db.items.filter(item => {
      const textMatch = !keyword || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(keyword);
      const categoryMatch = !category || category === "全部" || item.category === category;
      const statusMatch = status === "all" || item.status === status;
      return textMatch && categoryMatch && statusMatch;
    });

    send(res, 200, {
      items: sortForViewer(filtered, viewer).map(item => publicItem(item, viewer)),
      viewer: {
        campus: viewer.campus,
        building: viewer.building
      }
    });
    return;
  }

  const itemDetailMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (req.method === "GET" && itemDetailMatch) {
    const item = db.items.find(row => row.id === itemDetailMatch[1]);
    if (!item) {
      send(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }
    send(res, 200, { item: publicItem(item, viewer) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/items") {
    const input = await readBody(req);
    const required = ["title", "category", "quantity", "unit", "campus", "building", "expireDate"];
    const missing = required.filter(key => input[key] === undefined || input[key] === "");
    if (missing.length) {
      send(res, 400, { error: "VALIDATION_ERROR", message: `缺少字段: ${missing.join(", ")}` });
      return;
    }

    const item = {
      id: `item_${crypto.randomUUID().slice(0, 8)}`,
      title: String(input.title).trim(),
      category: String(input.category).trim(),
      description: String(input.description || "发布者暂未填写补充说明。").trim(),
      quantity: Number(input.quantity),
      unit: String(input.unit).trim(),
      campus: String(input.campus).trim(),
      building: String(input.building).trim(),
      expireDate: String(input.expireDate).trim(),
      status: "reviewing",
      ownerId: viewer.id,
      ownerName: viewer.name,
      contact: {
        wechat: viewer.wechat,
        qq: viewer.qq
      },
      createdAt: new Date().toISOString()
    };

    db.items.unshift(item);
    writeDb(db);
    send(res, 201, {
      item: publicItem(item, viewer),
      message: "已提交审核，Demo 环境中管理员可直接改为 online"
    });
    return;
  }

  const contactMatch = pathname.match(/^\/api\/items\/([^/]+)\/contact$/);
  if (req.method === "POST" && contactMatch) {
    const item = db.items.find(row => row.id === contactMatch[1]);
    if (!item) {
      send(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
      return;
    }

    const date = todayKey();
    const usedToday = db.contactViews.filter(view => view.viewerId === viewer.id && view.date === date).length;
    if (usedToday >= DAILY_CONTACT_LIMIT) {
      send(res, 429, { error: "CONTACT_LIMIT", message: "今日查看联系方式次数已用完" });
      return;
    }

    db.contactViews.push({
      id: `view_${crypto.randomUUID().slice(0, 8)}`,
      viewerId: viewer.id,
      itemId: item.id,
      date,
      viewedAt: new Date().toISOString()
    });
    writeDb(db);

    send(res, 200, {
      contact: item.contact,
      remaining: Math.max(DAILY_CONTACT_LIMIT - usedToday - 1, 0)
    });
    return;
  }

  send(res, 404, { error: "NOT_FOUND", message: "接口不存在" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(error);
    send(res, 500, { error: "SERVER_ERROR", message: error.message });
  });
});

server.listen(PORT, () => {
  console.log(`NanE API listening on http://localhost:${PORT}`);
});
