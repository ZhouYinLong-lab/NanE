const crypto = require("crypto");
const { emptyTrustSummary } = require("./util");

const JWT_SECRET = process.env.JWT_SECRET || (() => { console.warn("WARNING: JWT_SECRET not set, using dev fallback — do NOT use in production"); return "nane-dev-secret"; })();
const AGREEMENT_VERSION = "v1.0";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + 60 * 60 * 24 * 30 }));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, body, signature] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (signature.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (error) {
    return null;
  }
}

function agreementAccepted(input) {
  return input?.agreementAccepted === true && String(input.agreementVersion || AGREEMENT_VERSION) === AGREEMENT_VERSION;
}

function userHasAgreement(user) {
  return Boolean(user?.agreement_accepted_at && user?.agreement_version === AGREEMENT_VERSION);
}

function userProfileComplete(user) {
  return Boolean(user?.name && user?.campus && user?.building && user.building !== "未设置楼栋");
}

function publicUser(user, options = {}) {
  if (!user) {
    return null;
  }
  const {
    password_hash: passwordHash,
    password_salt: passwordSalt,
    ...safeUser
  } = user;
  return {
    ...safeUser,
    hasAgreement: userHasAgreement(user),
    profileComplete: userProfileComplete(user),
    agreementVersion: user.agreement_version || "",
    hasPassword: Boolean(passwordHash),
    trustSummary: options.trustSummary || emptyTrustSummary()
  };
}

module.exports = { signToken, verifyToken, publicUser, userHasAgreement, userProfileComplete, agreementAccepted };
