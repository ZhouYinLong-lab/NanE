const crypto = require("crypto");
const { query, makeId, hashPassword, DEMO_USER_ID } = require("../db");
const { signToken, verifyToken, publicUser, agreementAccepted } = require("../lib/jwt");
const { readBody, json, pick, REVIEW_TAGS, ISSUE_REVIEW_TAGS, emptyTrustSummary } = require("../lib/util");
const { recordFailedLogin, getLoginAttempts, resetLoginAttempts } = require("../middleware/rate-limit");
const { userFromRequest, demoViewer, requireVerifiedUser } = require("../middleware/auth");
const { nannaConfigured, callNanna, normalizeNannaIdentity, upsertNannaUser } = require("../service/nanna");
const { sendMail } = require("../service/email");
const { hashEmailCode, makeEmailCode, validateStudentEmail, normalizeEmail } = require("../service/email");

// --- Constants ---
const AGREEMENT_VERSION = "v1.0";
const NJU_STUDENT_EMAIL_SUFFIX = "@smail.nju.edu.cn";
const EMAIL_CODE_TTL_MINUTES = 5;
const NANNA_SCOPES = ["identity:basic:read", "identity:student_id:read", "identity:campus:read", "identity:major:read"];
const DEBUG_MODE = String(process.env.DEBUG_MODE || "false").toLowerCase() === "true";
const TEST_USER_IDS = ["u_demo"];

const NICKNAME_ADJECTIVES = ["热心", "快乐", "靠谱", "温柔", "元气", "清醒", "友善", "机灵", "真诚", "阳光", "安静", "勇敢"];
const NICKNAME_NOUNS = ["小蓝鲸", "小猫", "同学", "室友", "小南瓜", "小紫薯", "小云朵", "小星星", "小书包", "小梧桐", "小灯塔", "小雨伞"];

// --- Helper functions ---

function randomNickname() {
  const adjective = NICKNAME_ADJECTIVES[crypto.randomInt(0, NICKNAME_ADJECTIVES.length)];
  const noun = NICKNAME_NOUNS[crypto.randomInt(0, NICKNAME_NOUNS.length)];
  return `${adjective}${noun}`;
}

function hashUserPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 210000, 32, "sha256").toString("hex");
}

function makePasswordSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function validatePasswordStrength(password) {
  if (typeof password !== "string") {
    return "密码格式不正确";
  }
  if (password.length < 8) {
    return "密码至少需要 8 位";
  }
  if (password.length > 64) {
    return "密码最多 64 位";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "密码必须包含至少一个字母";
  }
  if (!/[0-9]/.test(password)) {
    return "密码必须包含至少一个数字";
  }
  return "";
}

async function setPassword(req, res) {
  const user = await userFromRequest(req);
  if (!user || !user.is_verified) {
    json(res, 401, { error: "AUTH_REQUIRED", message: "请先登录后再设置密码" });
    return;
  }
  const input = await readBody(req);
  const password = String(input.password || "");
  const validationError = validatePasswordStrength(password);
  if (validationError) {
    json(res, 400, { error: "VALIDATION_ERROR", message: validationError });
    return;
  }
  const salt = makePasswordSalt();
  const passwordHash = hashUserPassword(password, salt);
  await query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
    [passwordHash, salt, user.id]
  );
  json(res, 200, { message: "密码设置成功，下次可以使用邮箱和密码登录" });
}

async function passwordLogin(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  const password = String(input.password || "");
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  if (!password) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请输入密码" });
    return;
  }

  // Rate limit: check failed attempts
  const attemptKey = `pwd:${email}`;
  const now = Date.now();
  const record = getLoginAttempts(attemptKey);
  if (record && record.lockedUntil > now) {
    const waitMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    json(res, 429, { error: "LOGIN_RATE_LIMIT", message: `登录尝试次数过多，请 ${waitMinutes} 分钟后再试` });
    return;
  }

  const { rows } = await query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = true",
    [email]
  );
  const user = rows[0];
  if (!user || !user.password_hash || !user.password_salt) {
    recordFailedLogin(attemptKey);
    json(res, 401, { error: "INVALID_LOGIN", message: "账号或密码错误" });
    return;
  }
  const expectedHash = hashUserPassword(password, user.password_salt);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(user.password_hash, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    recordFailedLogin(attemptKey);
    json(res, 401, { error: "INVALID_LOGIN", message: "账号或密码错误" });
    return;
  }

  // Successful login clears failed attempts
  resetLoginAttempts(attemptKey);
  if (!user.agreement_version || user.agreement_version !== AGREEMENT_VERSION) {
    await query(
      "UPDATE users SET agreement_version = $1, agreement_accepted_at = now() WHERE id = $2",
      [AGREEMENT_VERSION, user.id]
    );
    user.agreement_version = AGREEMENT_VERSION;
    user.agreement_accepted_at = new Date().toISOString();
  }
  json(res, 200, {
    token: signToken({ sub: user.id, role: "user", provider: "password" }),
    user: publicUser(user),
    loginMode: "password"
  });
}

async function passwordResetChallenge(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  const { rows } = await query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = true",
    [email]
  );
  if (!rows[0]) {
    json(res, 200, { message: "如果该账号存在，验证码已发送至对应邮箱" });
    return;
  }
  if (!rows[0].password_hash) {
    json(res, 400, { error: "NO_PASSWORD", message: "该账号尚未设置密码，请使用邮箱验证码登录后设置密码" });
    return;
  }
  const recent = await query(
    "SELECT created_at FROM email_challenges WHERE email = $1 AND created_at > now() - interval '60 seconds' ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (recent.rows[0]) {
    json(res, 429, { error: "EMAIL_RATE_LIMIT", message: "验证码发送太频繁，请稍后再试" });
    return;
  }
  const code = makeEmailCode();
  const challengeId = makeId("email_challenge");
  await query(
    "INSERT INTO email_challenges (id, email, code_hash, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)",
    [challengeId, email, hashEmailCode(email, code), EMAIL_CODE_TTL_MINUTES]
  );
  await sendMail({
    to: email,
    subject: "NanE 南易密码重置验证码",
    text: [
      `你的 NanE 南易密码重置验证码是：${code}`,
      "",
      `验证码 ${EMAIL_CODE_TTL_MINUTES} 分钟内有效，请勿转发给他人。`,
      "如果这不是你本人操作，可以忽略这封邮件。"
    ].join("\n")
  });
  json(res, 200, {
    challengeId,
    expiresIn: EMAIL_CODE_TTL_MINUTES * 60,
    message: "验证码已发送至对应邮箱"
  });
}

async function passwordReset(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  const code = String(input.code || "").trim();
  const newPassword = String(input.password || "");
  const challengeId = String(input.challengeId || input.challenge_id || "").trim();
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写 6 位验证码" });
    return;
  }
  const validationError = validatePasswordStrength(newPassword);
  if (validationError) {
    json(res, 400, { error: "VALIDATION_ERROR", message: validationError });
    return;
  }
  const params = challengeId ? [challengeId, email] : [email];
  const sql = challengeId
    ? `SELECT * FROM email_challenges
       WHERE id = $1 AND email = $2 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM email_challenges
       WHERE email = $1 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`;
  const { rows } = await query(sql, params);
  const challenge = rows[0];
  if (!challenge || challenge.code_hash !== hashEmailCode(email, code)) {
    json(res, 400, { error: "INVALID_CODE", message: "验证码错误或已过期" });
    return;
  }
  await query("UPDATE email_challenges SET used_at = now() WHERE id = $1", [challenge.id]);
  const salt = makePasswordSalt();
  const passwordHash = hashUserPassword(newPassword, salt);
  const { rows: userRows } = await query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE email = $3 AND is_verified = true RETURNING *",
    [passwordHash, salt, email]
  );
  if (!userRows[0]) {
    json(res, 404, { error: "USER_NOT_FOUND", message: "账号不存在" });
    return;
  }
  json(res, 200, { message: "密码重置成功，请使用新密码登录" });
}

async function changePassword(req, res) {
  const user = await requireVerifiedUser(req, res);
  if (!user) {
    return;
  }
  const input = await readBody(req);
  const currentPassword = String(input.currentPassword || "");
  const newPassword = String(input.newPassword || "");
  const confirmPassword = String(input.confirmPassword || "");

  if (!user.password_hash || !user.password_salt) {
    json(res, 400, { error: "NO_PASSWORD", message: "请先通过邮箱验证码设置初始密码" });
    return;
  }
  if (!currentPassword) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请输入当前密码" });
    return;
  }
  const expectedHash = hashUserPassword(currentPassword, user.password_salt);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(user.password_hash, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    json(res, 400, { error: "WRONG_PASSWORD", message: "当前密码错误" });
    return;
  }
  const validationError = validatePasswordStrength(newPassword);
  if (validationError) {
    json(res, 400, { error: "VALIDATION_ERROR", message: validationError });
    return;
  }
  if (newPassword !== confirmPassword) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "两次输入的新密码不一致" });
    return;
  }
  const salt = makePasswordSalt();
  const passwordHash = hashUserPassword(newPassword, salt);
  await query(
    "UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3",
    [passwordHash, salt, user.id]
  );
  json(res, 200, { message: "密码修改成功" });
}

async function emailChallenge(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  if (!email) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写南京大学学生邮箱" });
    return;
  }
  if (!validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }

  const recent = await query(
    "SELECT created_at FROM email_challenges WHERE email = $1 AND created_at > now() - interval '60 seconds' ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (recent.rows[0]) {
    json(res, 429, { error: "EMAIL_RATE_LIMIT", message: "验证码发送太频繁，请稍后再试" });
    return;
  }

  const code = makeEmailCode();
  const challengeId = makeId("email_challenge");
  await query(
    `INSERT INTO email_challenges (id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [challengeId, email, hashEmailCode(email, code), EMAIL_CODE_TTL_MINUTES]
  );
  await sendMail({
    to: email,
    subject: "NanE 南易登录验证码",
    text: [
      `你的 NanE 南易登录验证码是：${code}`,
      "",
      `验证码 ${EMAIL_CODE_TTL_MINUTES} 分钟内有效，请勿转发给他人。`,
      "如果这不是你本人操作，可以忽略这封邮件。"
    ].join("\n")
  });

  json(res, 200, {
    challengeId,
    expiresIn: EMAIL_CODE_TTL_MINUTES * 60,
    message: `验证码已发送至 ${email}`
  });
}

async function upsertEmailUser(email) {
  const userId = `email_${crypto.createHash("sha1").update(email).digest("hex").slice(0, 16)}`;
  const name = randomNickname();
  const { rows } = await query(
    `INSERT INTO users (
      id, name, campus, building, wechat, qq, openid, auth_provider, email, is_verified,
      agreement_version, agreement_accepted_at
    )
    VALUES ($1, $2, '仙林校区', '未设置楼栋', '', '', $3, 'email', $4, true, $5, now())
    ON CONFLICT (id) DO UPDATE SET
      name = CASE
        WHEN users.name = split_part(EXCLUDED.email, '@', 1) THEN EXCLUDED.name
        ELSE users.name
      END,
      auth_provider = 'email',
      email = EXCLUDED.email,
      is_verified = true,
      agreement_version = EXCLUDED.agreement_version,
      agreement_accepted_at = EXCLUDED.agreement_accepted_at
    RETURNING *`,
    [userId, name, `email:${email}`, email, AGREEMENT_VERSION]
  );
  return rows[0];
}

async function emailVerify(req, res) {
  const input = await readBody(req);
  const email = normalizeEmail(input.email);
  const code = String(input.code || "").trim();
  const challengeId = String(input.challengeId || input.challenge_id || "").trim();
  if (!email || !validateStudentEmail(email)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "邮箱登录仅支持 @smail.nju.edu.cn 后缀" });
    return;
  }
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写 6 位邮箱验证码" });
    return;
  }
  const params = challengeId ? [challengeId, email] : [email];
  const sql = challengeId
    ? `SELECT * FROM email_challenges
       WHERE id = $1 AND email = $2 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM email_challenges
       WHERE email = $1 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`;
  const { rows } = await query(sql, params);
  const challenge = rows[0];
  if (!challenge || challenge.code_hash !== hashEmailCode(email, code)) {
    json(res, 400, { error: "INVALID_CODE", message: "验证码错误或已过期" });
    return;
  }
  await query("UPDATE email_challenges SET used_at = now() WHERE id = $1", [challenge.id]);
  const user = await upsertEmailUser(email);
  json(res, 200, {
    token: signToken({ sub: user.id, role: "user", provider: "email" }),
    user: publicUser(user),
    loginMode: "email"
  });
}

async function nannaChallenge(req, res) {
  if (!nannaConfigured()) {
    json(res, 503, { error: "NANNA_NOT_CONFIGURED", message: "服务器尚未配置南哪小帮手身份验证参数" });
    return;
  }
  const input = await readBody(req);
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  const email = String(input.email || "").trim();
  const studentId = String(input.studentId || input.student_id || "").trim();
  if (!email && !studentId) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写邮箱或学号以接收验证码" });
    return;
  }
  const data = await callNanna("/api/v1/oauth/challenge", {
    email: email || undefined,
    student_id: studentId || undefined,
    studentId: studentId || undefined
  });
  json(res, 200, {
    challengeId: pick(data, ["challenge_id", "challengeId", "id"], ""),
    maskedTarget: pick(data, ["masked_target", "maskedTarget", "target"], email || studentId),
    expiresIn: pick(data, ["expires_in", "expiresIn"], 300),
    message: data.message || "验证码已通过南哪小帮手发送"
  });
}

async function nannaVerify(req, res) {
  if (!nannaConfigured()) {
    json(res, 503, { error: "NANNA_NOT_CONFIGURED", message: "服务器尚未配置南哪小帮手身份验证参数" });
    return;
  }
  const input = await readBody(req);
  if (!agreementAccepted(input)) {
    json(res, 400, { error: "AGREEMENT_REQUIRED", message: "请先阅读并同意 NanE 用户协议" });
    return;
  }
  const code = String(input.code || input.challengeCode || "").trim();
  const challengeId = String(input.challengeId || input.challenge_id || "").trim();
  if (!code) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请填写南哪小帮手验证码" });
    return;
  }
  const data = await callNanna("/api/v1/oauth/verify", {
    challenge_id: challengeId || undefined,
    challengeId: challengeId || undefined,
    code,
    challenge_code: code,
    email: String(input.email || "").trim() || undefined,
    student_id: String(input.studentId || input.student_id || "").trim() || undefined
  });
  const identity = normalizeNannaIdentity(data, input);
  const user = await upsertNannaUser(identity, AGREEMENT_VERSION);
  json(res, 200, {
    token: signToken({ sub: user.id, role: "user", provider: "nanna" }),
    user: publicUser(user),
    loginMode: "nanna"
  });
}

async function handle(req, res, pathname, method) {
  if (method === "POST" && pathname === "/api/auth/wx-login") {
    const viewer = await demoViewer();
    const input = await readBody(req);
    json(res, 200, { token: signToken({ sub: viewer.id, role: "user" }), user: publicUser(viewer), loginMode: input.code ? "wx-code-demo" : "fallback-demo" });
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/email-login") {
    json(res, 410, { error: "ENDPOINT_DEPRECATED", message: "请使用邮箱验证码登录接口" });
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/email/challenge") {
    await emailChallenge(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/email/verify") {
    await emailVerify(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/password/set") {
    await setPassword(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/password/login") {
    await passwordLogin(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/password/reset-challenge") {
    await passwordResetChallenge(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/password/reset") {
    await passwordReset(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/password/change") {
    await changePassword(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/nanna/challenge") {
    await nannaChallenge(req, res);
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/nanna/verify") {
    await nannaVerify(req, res);
    return true;
  }

  return false;
}

module.exports = { handle };
