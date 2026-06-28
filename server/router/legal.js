/**
 * Legal router — user agreement and privacy policy endpoints.
 */
const fs = require("fs");
const path = require("path");
const { json } = require("../lib/util");

const AGREEMENT_VERSION = "v1.0";

async function handle(req, res, pathname, method) {
  if (method !== "GET") return false;

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
