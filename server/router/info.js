/**
 * Info router — health check, locations, and legal endpoints.
 */
const fs = require("fs");
const path = require("path");
const { json } = require("../lib/util");
const { streamImage } = require("../service/image-upload");
const locations = require("../../miniprogram/data/locations");

const AGREEMENT_VERSION = "v1.0";

async function handle(req, res, pathname, method) {
  if (method !== "GET") return false;

  // Image proxy — serves MinIO/local images through NanE's own port
  if (pathname.startsWith("/api/images/")) {
    const key = pathname.replace(/^\/api\/images\//, "");
    await streamImage(key, res);
    return true;
  }

  if (pathname === "/api/health") {
    json(res, 200, { ok: true, name: "NanE API", version: "0.2.0", database: "postgresql", time: new Date().toISOString() });
    return true;
  }

  if (pathname === "/api/locations") {
    json(res, 200, { locations });
    return true;
  }

  if (pathname === "/api/legal/agreement") {
    const markdown = fs.readFileSync(path.join(__dirname, "..", "..", "docs", "user-agreement.md"), "utf8");
    json(res, 200, { version: AGREEMENT_VERSION, markdown });
    return true;
  }

  if (pathname === "/api/legal/privacy") {
    const privacyPath = path.join(__dirname, "..", "..", "docs", "privacy-guideline-draft.md");
    const markdown = fs.existsSync(privacyPath)
      ? fs.readFileSync(privacyPath, "utf8")
      : "隐私保护指引暂不可用。";
    json(res, 200, { markdown });
    return true;
  }

  return false;
}

module.exports = { handle };
