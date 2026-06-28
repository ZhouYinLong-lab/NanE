const REVIEW_TAGS = ["沟通顺畅", "按约交接", "物品真实", "及时确认", "友善可信"];
const ISSUE_REVIEW_TAGS = ["物品不符", "未按约时间", "联系方式无效", "沟通不顺", "未完成交接"];

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  });
  res.end(JSON.stringify(payload));
}

function html(res, body) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8"
  });
  res.end(body);
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > limit) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function emptyTrustSummary() {
  return { completedCount: 0, givenCount: 0, receivedCount: 0, positiveReviewCount: 0, topTags: [] };
}

function parsePgArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value.replace(/^{|}$/g, "").split(",").map(item => item.replace(/^"|"$/g, "")).filter(Boolean);
  }
  return [];
}

function dateOnly(value) {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function normalizeImageUrls(input) {
  const rawUrls = Array.isArray(input) ? input : [];
  const urls = [];
  for (const raw of rawUrls) {
    const url = String(raw || "").trim();
    if (!url || urls.includes(url)) {
      continue;
    }
    if (url.startsWith("/uploads/") || url.startsWith("/api/images/") || /^https?:\/\//i.test(url)) {
      urls.push(url.slice(0, 500));
    }
  }
  return urls.slice(0, 3);
}

function normalizeReviewTags(input, outcome = "positive") {
  const allowedTags = outcome === "issue" ? ISSUE_REVIEW_TAGS : REVIEW_TAGS;
  const rawTags = Array.isArray(input) ? input : [];
  const unique = [];
  for (const raw of rawTags) {
    const tag = String(raw || "").trim();
    if (allowedTags.includes(tag) && !unique.includes(tag)) {
      unique.push(tag);
    }
  }
  return unique.slice(0, 5);
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

function pick(source, keys, fallback = "") {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return fallback;
}

module.exports = { json, html, readBody, emptyTrustSummary, parsePgArray, dateOnly, normalizeImageUrls, normalizeReviewTags, escapeHtml, pick, REVIEW_TAGS, ISSUE_REVIEW_TAGS };
