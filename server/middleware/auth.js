const { query, DEMO_USER_ID } = require("../db");
const { verifyToken } = require("../lib/jwt");
const { userHasAgreement, userProfileComplete } = require("../lib/jwt");
const { json } = require("../lib/util");

const locations = require("../../miniprogram/data/locations");

async function demoViewer() {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [DEMO_USER_ID]);
  return rows[0];
}

async function userFromRequest(req) {
  const auth = req.headers.authorization || "";
  const payload = verifyToken(auth.replace(/^Bearer\s+/i, ""));
  if (payload?.role === "user" && payload.sub) {
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
    if (rows[0]) {
      return rows[0];
    }
  }
  return null;
}

async function viewerFromRequest(req) {
  return (await userFromRequest(req)) || demoViewer();
}

function locationExists(campusName, buildingName, roomName = "") {
  const campus = locations.find(item => item.name === campusName);
  if (!campus) {
    return false;
  }
  const building = (campus.buildings || []).find(item => item.name === buildingName);
  if (!building) {
    return false;
  }
  if (!roomName) {
    return true;
  }
  return (building.rooms || []).includes(roomName);
}

async function requireVerifiedUser(req, res) {
  const user = await userFromRequest(req);
  if (!user || !user.is_verified) {
    json(res, 401, { error: "AUTH_REQUIRED", message: "请先登录或使用南哪小帮手完成校园身份验证" });
    return null;
  }
  if (!userHasAgreement(user)) {
    json(res, 403, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return null;
  }
  if (!userProfileComplete(user)) {
    json(res, 403, { error: "PROFILE_REQUIRED", message: "请先在“我的”页设置昵称、校区和楼栋" });
    return null;
  }
  return user;
}

function adminFromRequest(req) {
  const auth = req.headers.authorization || "";
  return verifyToken(auth.replace(/^Bearer\s+/i, ""));
}

async function requireAdmin(req, res) {
  const admin = adminFromRequest(req);
  if (!admin || admin.role !== "admin") {
    json(res, 401, { error: "UNAUTHORIZED", message: "请先登录管理员后台" });
    return null;
  }
  return admin;
}

module.exports = { demoViewer, userFromRequest, viewerFromRequest, requireVerifiedUser, requireAdmin, locationExists };
