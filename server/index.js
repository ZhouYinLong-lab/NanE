const http = require("http");
const fs = require("fs");
const path = require("path");
require("./env");
const { initializeDatabase } = require("./db");
const { json, html } = require("./lib/util");
const { logError } = require("./lib/logger");

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
  const isHtml = ext === ".html";
  // Security headers applied to all static responses
  const headers = {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    // Prevent MIME-type sniffing attacks
    "X-Content-Type-Options": "nosniff",
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    // Force HTTPS (only effective when deployed behind TLS)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
  };
  // Content-Security-Policy: applied to HTML pages as a server-enforced layer
  // (also present as a <meta> tag in index.html).
  // NOTE: 'unsafe-inline' is required for styles because of extensive inline style usage.
  // For scripts, it's required due to inline event handlers (onerror on images, service worker registration).
  // Future refactoring should remove inline handlers and move toward strict CSP.
  if (isHtml) {
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join("; ");
  }
  // Cache static assets aggressively (1 year, immutable) for versioned files
  // HTML is not cached to ensure fresh content
  if (!isHtml && [".css", ".js", ".woff2", ".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }
  res.writeHead(200, headers);
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
  if (pathname.startsWith("/admin/")) {
    const relative = pathname.replace(/^\/admin\//, "");
    return path.join(__dirname, "..", "admin", relative);
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
    path.join(__dirname, "..", "admin"),
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
  require("./router/info"),
  require("./router/auth"),
  require("./router/uploads"),
  require("./router/me"),
  require("./router/items"),
  require("./router/claims"),
  require("./router/admin")
];

// ── CSRF Protection ──────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "https://nane.zylatent.com",
  "http://localhost:" + PORT,
  `http://localhost:${PORT}`,
  "http://127.0.0.1:" + PORT,
  `http://127.0.0.1:${PORT}`
];

function csrfSafe(req) {
  // Only check POST/PUT/DELETE/PATCH methods (state-changing requests)
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return true;

  const origin = req.headers["origin"];
  const referer = req.headers["referer"];

  // If Origin header is present, it must match an allowed origin
  if (origin) {
    const originOk = ALLOWED_ORIGINS.some(allowed =>
      origin === allowed || origin.startsWith(allowed + "/")
    );
    if (!originOk) {
      logError(new Error("CSRF: invalid Origin"), { origin, path: req.url });
      return false;
    }
    return true;
  }

  // If no Origin but Referer is present, validate it
  if (referer) {
    const refererOk = ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed));
    if (!refererOk) {
      logError(new Error("CSRF: invalid Referer"), { referer, path: req.url });
      return false;
    }
    return true;
  }

  // No Origin or Referer header — allow through (e.g., server-to-server API calls, CLI tools, curl)
  return true;
}

// ── Main handler ─────────────────────────────────────────────────

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    // CORS preflight — set allowed origins for future requests
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  // CSRF protection: validate Origin/Referer for state-changing requests
  if (!csrfSafe(req)) {
    json(res, 403, { error: "CSRF_REJECTED", message: "请求来源不被允许" });
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
    logError(error, { event: "unhandled_request_error" });
    json(res, 500, { error: "SERVER_ERROR", message: "服务器内部错误，请稍后重试" });
  });
});

initializeDatabase()
  .then(() => {
    // Startup orphan image cleanup (best-effort)
    const { cleanupLocalOrphanImages } = require("./service/image-upload");
    cleanupLocalOrphanImages().catch(error => {
      logError(error, { event: "orphan_image_cleanup_failed" });
    });
    setInterval(() => {
      cleanupLocalOrphanImages().catch(error => {
        logError(error, { event: "orphan_image_cleanup_failed" });
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
