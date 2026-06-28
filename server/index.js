const http = require("http");
const fs = require("fs");
const path = require("path");
require("./env");
const { initializeDatabase } = require("./db");
const { json, html } = require("./lib/util");

const PORT = Number(process.env.PORT || 37878);

// ── Static file serving ──────────────────────────────────────────

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
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
  if (pathname.startsWith("/uploads/")) {
    const relative = pathname.replace(/^\/uploads\//, "");
    return path.join(UPLOAD_DIR, relative);
  }
  return "";
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET") return false;
  const filePath = staticPathFromRequest(pathname);
  if (!filePath) return false;
  const roots = [
    path.join(__dirname, "..", "web"),
    path.join(__dirname, "..", "miniprogram", "assets"),
    UPLOAD_DIR
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

// ── Routers ──────────────────────────────────────────────────────

const routers = [
  require("./router/health"),
  require("./router/legal"),
  require("./router/auth"),
  require("./router/uploads"),
  require("./router/me"),
  require("./router/items"),
  require("./router/claims"),
  require("./router/admin")
];

// ── Main handler ─────────────────────────────────────────────────

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  const pathname = new URL(req.url, "http://localhost").pathname;

  // Admin console page
  if (req.method === "GET" && pathname === "/admin") {
    const { adminPage } = require("./router/admin");
    html(res, adminPage());
    return;
  }

  // Static files
  if (serveStatic(req, res, pathname)) {
    return;
  }

  // API routers
  for (const router of routers) {
    if (await router.handle(req, res, pathname, req.method)) {
      return;
    }
  }

  json(res, 404, { error: "NOT_FOUND", message: "接口不存在" });
}

// ── Server ───────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      event: "unhandled_request_error",
      message: error.message || String(error),
      stack: error.stack
    }));
    json(res, 500, { error: "SERVER_ERROR", message: "服务器内部错误，请稍后重试" });
  });
});

initializeDatabase()
  .then(() => {
    // Startup orphan image cleanup (best-effort)
    const { cleanupLocalOrphanImages } = require("./service/image-upload");
    cleanupLocalOrphanImages().catch(error => {
      console.error(JSON.stringify({
        level: "warn",
        time: new Date().toISOString(),
        event: "orphan_image_cleanup_failed",
        message: error.message || String(error)
      }));
    });
    setInterval(() => {
      cleanupLocalOrphanImages().catch(error => {
        console.error(JSON.stringify({
          level: "warn",
          time: new Date().toISOString(),
          event: "orphan_image_cleanup_failed",
          message: error.message || String(error)
        }));
      });
    }, 6 * 60 * 60 * 1000).unref();

    server.listen(PORT, () => {
      console.log(`NanE API listening on http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error("Failed to initialize NanE database:", error.stack || error.message || error);
    process.exit(1);
  });
