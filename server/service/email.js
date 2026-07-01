const crypto = require("crypto");
const tls = require("tls");

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const JWT_SECRET = process.env.JWT_SECRET || "nane-dev-secret";
const PUBLIC_WEB_URL = String(process.env.PUBLIC_WEB_URL || "https://nane.zylatent.com").replace(/\/+$/, "");
const NJU_STUDENT_EMAIL_SUFFIX = "@smail.nju.edu.cn";

function smtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

function dotStuff(value) {
  return String(value).replace(/^\./gm, "..");
}

function parseAddress(input) {
  const value = String(input || "").trim();
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return {
      header: value,
      address: value
    };
  }
  const name = match[1].trim();
  const address = match[2].trim();
  return {
    header: `${encodeHeader(name)} <${address}>`,
    address
  };
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function emailHtmlLine(html) {
  return { __naneTrustedHtml: String(html || "") };
}

function renderEmailBodyLine(line) {
  if (line && typeof line === "object" && Object.prototype.hasOwnProperty.call(line, "__naneTrustedHtml")) {
    return line.__naneTrustedHtml;
  }
  return escapeHtml(line);
}

function smtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = chunk => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const last = lines[lines.length - 1];
      if (/^\d{3} /.test(last)) {
        socket.off("data", onData);
        const code = Number(last.slice(0, 3));
        if (code >= 400) {
          reject(new Error(last));
          return;
        }
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

async function smtpCommand(socket, command) {
  socket.write(`${command}\r\n`);
  return smtpResponse(socket);
}

function emailHtml(title, bodyLines, actionUrl, actionText) {
  const safeTitle = escapeHtml(title);
  const safeBody = (bodyLines || []).map(renderEmailBodyLine).join('<br>');
  const safeActionUrl = escapeHtml(actionUrl || "");
  const safeActionText = escapeHtml(actionText || "");
  const actionBlock = actionUrl
    ? `<a href="${safeActionUrl}" style="display:inline-block;padding:14px 32px;background:#6E0065;color:#fffaf2;border-radius:999px;font-weight:900;text-decoration:none;font-size:16px;margin:12px 0">${safeActionText}</a>`
    : "";
  const linkNote = actionUrl
    ? `<p style="color:#a09b91;font-size:12px;margin-top:16px">如果按钮无法点击，请复制以下链接到浏览器：<br>${safeActionUrl}</p>`
    : "";
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head><meta charset="utf-8"></head>',
    '<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px;background:#fffaf2">',
    '  <table style="width:100%;margin-bottom:20px">',
    '    <tr><td style="font-size:20px;font-weight:900;color:#6E0065">NanE <span style="font-weight:400;color:#6f6a61">南易</span></td></tr>',
    '  </table>',
    `  <p style="font-size:16px;line-height:1.6;margin:0 0 8px"><strong>${safeTitle}</strong></p>`,
    `  <p style="font-size:15px;line-height:1.7;color:#3f3a31;margin:0 0 16px">${safeBody}</p>`,
    `  ${actionBlock}`,
    `  ${linkNote}`,
    '  <hr style="border:none;border-top:1px solid #e4ded3;margin:24px 0 12px">',
    '  <p style="color:#a09b91;font-size:11px">NanE 南易 · 南大校园免费互助平台<br>这是一封系统自动发送的邮件，请勿回复。</p>',
    '</body>',
    '</html>'
  ].join("\n");
}

async function sendMail({ to, subject, text, html }) {
  if (!smtpConfigured()) {
    throw new Error("服务器尚未配置 SMTP 发信参数");
  }
  const from = parseAddress(SMTP_FROM);
  const socket = tls.connect({
    host: SMTP_HOST,
    port: SMTP_PORT,
    servername: SMTP_HOST,
    rejectUnauthorized: SMTP_SECURE
  });
  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });
  try {
    await smtpResponse(socket);
    await smtpCommand(socket, `EHLO ${SMTP_HOST}`);
    await smtpCommand(socket, "AUTH LOGIN");
    await smtpCommand(socket, Buffer.from(SMTP_USER).toString("base64"));
    await smtpCommand(socket, Buffer.from(SMTP_PASS).toString("base64"));
    await smtpCommand(socket, `MAIL FROM:<${SMTP_USER}>`);
    await smtpCommand(socket, `RCPT TO:<${to}>`);
    await smtpCommand(socket, "DATA");
    const boundary = `nane-${crypto.randomBytes(8).toString("hex")}`;
    const parts = [
      `From: ${from.header}`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0"
    ];
    if (html) {
      parts.push(
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(text),
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(html),
        `--${boundary}--`
      );
    } else {
      parts.push(
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(text)
      );
    }
    const message = `${parts.join("\r\n")}\r\n.`;
    await smtpCommand(socket, message);
    await smtpCommand(socket, "QUIT");
  } finally {
    socket.end();
  }
}

function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function validateStudentEmail(email) {
  return email.endsWith(NJU_STUDENT_EMAIL_SUFFIX);
}

function hashEmailCode(email, code) {
  return crypto.createHash("sha256").update(`nane-email:${email}:${code}:${JWT_SECRET}`).digest("hex");
}

function makeEmailCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendClaimNotificationMail(ownerEmail, item, claim) {
  if (!ownerEmail) {
    return false;
  }
  const requesterName = claim.requesterName || "有同学";
  const claimQty = claim.quantity || 1;
  const claimUnit = item.unit || "件";
  const link = `${PUBLIC_WEB_URL}?view=mine&focus=claims`;
  const safeRequesterName = escapeHtml(requesterName);
  const safeItemTitle = escapeHtml(item.title);
  const safeClaimQty = escapeHtml(claimQty);
  const safeClaimUnit = escapeHtml(claimUnit);
  const safeCampus = escapeHtml(item.campus);
  const safeBuilding = escapeHtml(item.building);
  const safeLink = escapeHtml(link);
  try {
    await sendMail({
      to: ownerEmail,
      subject: "NanE 南易领取确认提醒",
      text: [
        `${requesterName} 提醒你：TA 已联系并领取了你发布的物品。`,
        "",
        `物品：${item.title}`,
        `领取数量：${claimQty}${claimUnit}`,
        `位置：${item.campus} · ${item.building}`,
        "",
        "请点击下方链接登录 NanE，在「我的发布」中确认领取或忽略该提醒。",
        link,
        "",
        "确认后系统会自动扣减剩余数量；如果数量扣到 0，物品会自动下架。",
        "如果你们尚未完成领取，可以先忽略这封邮件。"
      ].join("\n"),
      html: [
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head><meta charset="utf-8"></head>',
        '<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">',
        `  <p style="font-size:16px;line-height:1.6">${safeRequesterName} 提醒你：<strong>TA 已联系并领取了你发布的物品</strong>。</p>`,
        '  <table style="width:100%;border-collapse:collapse;margin:18px 0;background:#fffaf2;border:1px solid #e4ded3;border-radius:12px">',
        `    <tr><td style="padding:10px 16px;font-weight:700;color:#6f6a61">物品</td><td style="padding:10px 16px">${safeItemTitle}</td></tr>`,
        `    <tr><td style="padding:10px 16px;font-weight:700;color:#6f6a61">领取数量</td><td style="padding:10px 16px">${safeClaimQty}${safeClaimUnit}</td></tr>`,
        `    <tr><td style="padding:10px 16px;font-weight:700;color:#6f6a61">位置</td><td style="padding:10px 16px">${safeCampus} · ${safeBuilding}</td></tr>`,
        '  </table>',
        `  <a href="${safeLink}" style="display:inline-block;padding:14px 32px;background:#6E0065;color:#fffaf2;border-radius:999px;font-weight:900;text-decoration:none;font-size:16px;margin:12px 0">去 NanE 确认领取</a>`,
        '  <p style="color:#6f6a61;font-size:14px;line-height:1.6;margin-top:20px">确认后系统会自动扣减剩余数量；如果数量扣到 0，物品会自动下架。<br>如果你们尚未完成领取，可以先忽略这封邮件。</p>',
        `  <p style="color:#a09b91;font-size:12px;margin-top:16px">如果按钮无法点击，请复制以下链接到浏览器：<br>${safeLink}</p>`,
        '</body>',
        '</html>'
      ].join("\n")
    });
    return true;
  } catch (error) {
    console.error("Claim notification email failed:", error.message);
    return false;
  }
}

module.exports = { smtpConfigured, sendMail, emailHtml, emailHtmlLine, hashEmailCode, makeEmailCode, validateStudentEmail, normalizeEmail, sendClaimNotificationMail };
