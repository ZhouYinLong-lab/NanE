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

function putObjectToMinio(key, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(MINIO_ENDPOINT);
    const encodedKey = key.split("/").map(part => encodeURIComponent(part)).join("/");
    const objectPath = `/${MINIO_BUCKET}/${encodedKey}`;
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
  if (minioConfigured()) {
    await putObjectToMinio(key, buffer, contentType);
    const baseUrl = MINIO_PUBLIC_URL || `${MINIO_ENDPOINT}/${MINIO_BUCKET}`;
    return { url: `${baseUrl}/${key}`, key, storage: "minio" };
  }
  const localPath = path.join(UPLOAD_DIR, key);
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
  await fs.promises.writeFile(localPath, buffer);
  return { url: `/uploads/${key}`, key, storage: "local" };
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
  putObjectToMinio,
  uploadImageBuffer,
  localUploadPathFromUrl,
  cleanupEmptyDirs,
  deleteLocalImageIfUnused,
  cleanupLocalOrphanImages
};
