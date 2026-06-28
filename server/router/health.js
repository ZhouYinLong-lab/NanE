/**
 * Health router — health check and locations endpoint.
 */
const { json } = require("../lib/util");
const locations = require("../../miniprogram/data/locations");

async function handle(req, res, pathname, method) {
  if (method !== "GET") return false;

  if (pathname === "/api/health") {
    json(res, 200, { ok: true, name: "NanE API", version: "0.2.0", database: "postgresql", time: new Date().toISOString() });
    return true;
  }

  if (pathname === "/api/locations") {
    json(res, 200, { locations });
    return true;
  }

  return false;
}

module.exports = { handle };
