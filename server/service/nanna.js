const crypto = require("crypto");
const { query, makeId } = require("../db");
const { pick } = require("../lib/util");

const NANNA_API_BASE = String(process.env.NANNA_API_BASE || "").replace(/\/+$/, "");
const NANNA_APP_UID = process.env.NANNA_APP_UID || "";
const NANNA_API_KEY = process.env.NANNA_API_KEY || "";
const NANNA_SCOPES = ["identity:basic:read", "identity:student_id:read", "identity:campus:read", "identity:major:read"];
const AGREEMENT_VERSION = "v1.0";

function nannaConfigured() {
  return Boolean(NANNA_API_BASE && NANNA_APP_UID && NANNA_API_KEY);
}

function nannaHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${NANNA_API_KEY}`
  };
}

async function callNanna(pathname, payload) {
  const response = await fetch(`${NANNA_API_BASE}${pathname}`, {
    method: "POST",
    headers: nannaHeaders(),
    body: JSON.stringify({
      app_uid: NANNA_APP_UID,
      appUid: NANNA_APP_UID,
      scopes: NANNA_SCOPES,
      scope: NANNA_SCOPES.join(" "),
      ...payload
    })
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message = data.message || data.error_description || data.error || "南哪小帮手接口请求失败";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

function normalizeNannaIdentity(data, input = {}) {
  const profile = data.user || data.profile || data.identity || data.data || data;
  const openid = String(pick(profile, ["openid", "openId", "open_id", "sub", "id"], "")).trim();
  const email = String(pick(profile, ["email"], input.email || "")).trim();
  const studentId = String(pick(profile, ["student_id", "studentId", "studentID"], input.studentId || "")).trim();
  const campus = String(pick(profile, ["campus", "campus_name", "campusName"], "仙林校区")).trim();
  const building = String(pick(profile, ["building", "building_name", "buildingName", "dormitory"], "未设置楼栋")).trim();
  return {
    openid,
    name: String(pick(profile, ["name", "nickname", "display_name", "displayName"], "南易用户")).trim(),
    campus,
    building,
    email,
    studentIdMasked: studentId ? `${studentId.slice(0, 3)}****${studentId.slice(-2)}` : "",
    major: String(pick(profile, ["major", "department"], "")).trim()
  };
}

async function upsertNannaUser(identity, agreementVersion = AGREEMENT_VERSION) {
  if (!identity.openid) {
    throw new Error("南哪小帮手未返回 openid，无法建立 NanE 账号");
  }
  const userId = makeId("user");
  const { rows } = await query(
    `INSERT INTO users (
      id, name, campus, building, wechat, qq, openid, auth_provider, email, student_id_masked, major, is_verified,
      agreement_version, agreement_accepted_at
    )
    VALUES ($1, $2, $3, $4, '', '', $5, 'nanna', $6, $7, $8, true, $9, now())
    ON CONFLICT (openid) DO UPDATE SET
      name = EXCLUDED.name,
      campus = EXCLUDED.campus,
      building = EXCLUDED.building,
      auth_provider = 'nanna',
      email = EXCLUDED.email,
      student_id_masked = EXCLUDED.student_id_masked,
      major = EXCLUDED.major,
      is_verified = true,
      agreement_version = EXCLUDED.agreement_version,
      agreement_accepted_at = EXCLUDED.agreement_accepted_at
    RETURNING *`,
    [
      userId,
      identity.name || "南易用户",
      identity.campus || "仙林校区",
      identity.building || "未设置楼栋",
      identity.openid,
      identity.email || null,
      identity.studentIdMasked || null,
      identity.major || null,
      agreementVersion
    ]
  );
  return rows[0];
}

module.exports = { nannaConfigured, callNanna, normalizeNannaIdentity, upsertNannaUser };
