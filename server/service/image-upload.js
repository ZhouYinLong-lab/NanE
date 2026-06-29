/**
 * Image upload service (MinIO S3 + local fallback) extracted from server/index.js.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { query } = require("../db");
const { logError } = require("../lib/logger");

const MINIO_ENDPOINT = String(process.env.MINIO_ENDPOINT || "").replace(/\/+$/, "");
const MINIO_BUCKET = process.env.MINIO_BUCKET || "";
const MINIO_REGION = process.env.MINIO_REGION || "us-east-1";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "";
const MINIO_PUBLIC_URL = String(process.env.MINIO_PUBLIC_URL || "").replace(/\/+$/, "");
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value).digest(encoding);
}

function sha256(value, encoding = "hex") {
  return crypto.createHash("sha256").update(value).digest(encoding);
}

function minioConfigured() {
  return Boolean(MINIO_ENDPOINT && MINIO_BUCKET && MINIO_ACCESS_KEY && MINIO_SECRET_KEY);
}

function s3SigningKey(dateStamp) {
  const kDate = hmac(`AWS4${MINIO_SECRET_KEY}`, dateStamp);
  const kRegion = hmac(kDate, MINIO_REGION);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function normalizeStorageKey(key) {
  const value = String(key || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!value || value.includes("\0")) return "";
  const normalized = path.posix.normalize(value);
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    return "";
  }
  return normalized;
}

function encodedObjectPath(key) {
  return `/${MINIO_BUCKET}/${key.split("/").map(part => encodeURIComponent(part)).join("/")}`;
}

function signMinioRequest(method, objectPath, payloadHash) {
  const endpoint = new URL(MINIO_ENDPOINT);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const host = endpoint.host;
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n") + "\n";
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    objectPath,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${MINIO_REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");
  const signature = hmac(s3SigningKey(dateStamp), stringToSign, "hex");
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${MINIO_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate
  };
}

function putObjectToMinio(key, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(MINIO_ENDPOINT);
    const objectPath = encodedObjectPath(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(buffer);
    const host = endpoint.host;
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`
    ].join("\n") + "\n";
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      "PUT",
      objectPath,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join("\n");
    const credentialScope = `${dateStamp}/${MINIO_REGION}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256(canonicalRequest)
    ].join("\n");
    const signature = hmac(s3SigningKey(dateStamp), stringToSign, "hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${MINIO_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const transport = endpoint.protocol === "https:" ? require("https") : require("http");
    const request = transport.request({
      method: "PUT",
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      port: endpoint.port,
      path: objectPath,
      headers: {
        Authorization: authorization,
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate
      }
    }, response => {
      let responseBody = "";
      response.on("data", chunk => { responseBody += chunk; });
      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
          return;
        }
        reject(new Error(`MinIO upload failed: ${response.statusCode} ${responseBody}`));
      });
    });
    request.on("error", reject);
    request.end(buffer);
  });
}

async function uploadImageBuffer(buffer, contentType, key) {
  const safeKey = normalizeStorageKey(key);
  if (!safeKey) {
    throw new Error("Invalid upload key");
  }
  if (minioConfigured()) {
    await putObjectToMinio(safeKey, buffer, contentType);
    // Use NanE's own image proxy instead of exposing MinIO directly.
    // Avoids opening extra firewall ports — all traffic goes through :37878.
    return { url: `/api/images/${safeKey}`, key: safeKey, storage: "minio" };
  }
  const localPath = path.join(UPLOAD_DIR, safeKey);
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
  await fs.promises.writeFile(localPath, buffer);
  return { url: `/uploads/${safeKey}`, key: safeKey, storage: "local" };
}

async function streamImage(key, res) {
  const safeKey = normalizeStorageKey(key);
  if (!safeKey) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Image not found");
    return;
  }
  if (minioConfigured()) {
    const endpoint = new URL(MINIO_ENDPOINT);
    const objectPath = encodedObjectPath(safeKey);
    const transport = endpoint.protocol === "https:" ? require("https") : require("http");
    return new Promise(resolve => {
      const request = transport.request({
        method: "GET",
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port,
        path: objectPath,
        headers: signMinioRequest("GET", objectPath, "UNSIGNED-PAYLOAD")
      }, imageRes => {
        if (imageRes.statusCode >= 200 && imageRes.statusCode < 300) {
          const contentType = imageRes.headers["content-type"] || "image/webp";
          res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=2592000, immutable",
            "Content-Length": imageRes.headers["content-length"] || undefined
          });
          imageRes.on("end", resolve);
          imageRes.on("error", () => {
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "text/plain" });
            }
            res.end("Image unavailable");
            resolve();
          });
          imageRes.pipe(res);
        } else {
          imageRes.resume();
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Image not found");
          imageRes.on("end", resolve);
        }
      });
      request.on("error", () => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Image unavailable");
        resolve();
      });
      request.end();
    });
  }
  // Local storage fallback
  const localPath = path.join(UPLOAD_DIR, safeKey);
  try {
    const stat = await fs.promises.stat(localPath);
    const ext = path.extname(safeKey).toLowerCase();
    const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "image/webp",
      "Cache-Control": "public, max-age=2592000, immutable",
      "Content-Length": stat.size
    });
    fs.createReadStream(localPath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Image not found");
  }
}

function localUploadPathFromUrl(url) {
  const value = String(url || "");
  if (!value.startsWith("/uploads/")) {
    return "";
  }
  const relative = value.replace(/^\/uploads\//, "");
  const resolved = path.resolve(UPLOAD_DIR, relative);
  const root = path.resolve(UPLOAD_DIR);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    return "";
  }
  return resolved;
}

async function cleanupEmptyDirs(startDir) {
  const root = path.resolve(UPLOAD_DIR);
  let current = path.resolve(startDir);
  while (current.startsWith(root) && current !== root) {
    try {
      const entries = await fs.promises.readdir(current);
      if (entries.length) {
        return;
      }
      await fs.promises.rmdir(current);
      current = path.dirname(current);
    } catch {
      return;
    }
  }
}

async function deleteLocalImageIfUnused(url) {
  const target = localUploadPathFromUrl(url);
  if (!target) {
    return;
  }
  const stillUsed = await query(
    "SELECT id FROM items WHERE $1 = ANY(image_urls) LIMIT 1",
    [url]
  );
  if (stillUsed.rows[0]) {
    return;
  }
  try {
    await fs.promises.unlink(target);
    await cleanupEmptyDirs(path.dirname(target));
  } catch (error) {
    if (error.code !== "ENOENT") {
      logError(error, { event: "local_image_cleanup_failed", url });
    }
  }
}

async function cleanupLocalOrphanImages() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    return;
  }
  const referenced = await query(
    `SELECT DISTINCT unnest(image_urls) AS url
     FROM items
     WHERE cardinality(image_urls) > 0`
  );
  const used = new Set(referenced.rows.map(row => row.url).filter(url => String(url).startsWith("/uploads/")));
  async function walk(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        await cleanupEmptyDirs(fullPath);
        continue;
      }
      const relativeUrl = `/uploads/${path.relative(UPLOAD_DIR, fullPath).replace(/\\/g, "/")}`;
      if (!used.has(relativeUrl)) {
        await deleteLocalImageIfUnused(relativeUrl);
      }
    }
  }
  await walk(UPLOAD_DIR);
}

module.exports = {
  hmac,
  sha256,
  minioConfigured,
  s3SigningKey,
  normalizeStorageKey,
  encodedObjectPath,
  signMinioRequest,
  putObjectToMinio,
  uploadImageBuffer,
  localUploadPathFromUrl,
  cleanupEmptyDirs,
  deleteLocalImageIfUnused,
  cleanupLocalOrphanImages,
  streamImage
};
