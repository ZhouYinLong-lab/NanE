/**
 * Upload router — image upload endpoint.
 */
const { makeId } = require("../db");
const { readBody, json } = require("../lib/util");
const { requireVerifiedUser } = require("../middleware/auth");
const { uploadImageBuffer } = require("../service/image-upload");

async function uploadImage(req, res, viewer) {
  const input = await readBody(req, 7_000_000);
  const dataUrl = String(input.dataUrl || "");
  const match = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) {
    json(res, 400, { error: "INVALID_IMAGE", message: "请上传 PNG、JPG 或 WebP 图片" });
    return;
  }
  const extension = match[1].replace("jpeg", "jpg");
  const contentType = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) {
    json(res, 400, { error: "IMAGE_TOO_LARGE", message: "图片需小于 3MB" });
    return;
  }
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const key = `items/${viewer.id}/${yyyy}/${mm}/${makeId("img")}.${extension}`;
  try {
    const uploaded = await uploadImageBuffer(buffer, contentType, key);
    json(res, 201, { ...uploaded, contentType, size: buffer.length });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      event: "image_upload_failed",
      userId: viewer.id,
      message: error.message || String(error)
    }));
    json(res, 502, { error: "UPLOAD_FAILED", message: "图片上传失败，请稍后重试" });
  }
}

async function handle(req, res, pathname, method) {
  if (method === "POST" && pathname === "/api/uploads/images") {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    await uploadImage(req, res, viewer);
    return true;
  }

  return false;
}

module.exports = { handle };
