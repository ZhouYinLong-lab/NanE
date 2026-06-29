/**
 * Claims router — item claiming, claim reviews, fulfillment reviews.
 */
const { query, makeId } = require("../db");
const { readBody, json, REVIEW_TAGS, ISSUE_REVIEW_TAGS, normalizeReviewTags } = require("../lib/util");
const { requireVerifiedUser } = require("../middleware/auth");
const { sendClaimNotificationMail } = require("../service/email");
const { sendToUser } = require("../service/push");
const { emptyTrustSummary } = require("../lib/util");
const { itemFromRow, trustSummariesForUsers, attachOwnerTrustSummaries, ITEM_TYPES, pendingReviewFromRow } = require("../lib/item-utils");

function claimFromRow(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    quantity: row.quantity,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

async function requestClaim(req, res, viewer, itemId) {
  const input = await readBody(req);
  const quantity = Math.max(1, Number(input.quantity || 1));
  if (!Number.isInteger(quantity)) {
    json(res, 400, { error: "INVALID_QUANTITY", message: "领取数量必须是正整数" });
    return;
  }

  const { rows } = await query(
    `SELECT i.*, u.email AS owner_email, COALESCE(u.claim_email_enabled, true) AS owner_claim_email_enabled
     FROM items i
     LEFT JOIN users u ON u.id = i.owner_id
     WHERE i.id = $1`,
    [itemId]
  );
  const item = rows[0];
  if (!item) {
    json(res, 404, { error: "ITEM_NOT_FOUND", message: "物品不存在" });
    return;
  }
  if (item.status !== "online") {
    json(res, 409, { error: "ITEM_NOT_ONLINE", message: "该物品当前不可领取" });
    return;
  }
  if (item.owner_id === viewer.id) {
    json(res, 400, { error: "OWNER_CANNOT_CLAIM", message: "不能领取自己发布的物品" });
    return;
  }
  if (quantity > item.quantity) {
    json(res, 400, { error: "QUANTITY_EXCEEDED", message: "领取数量不能超过当前剩余数量" });
    return;
  }

  const existing = await query(
    "SELECT * FROM claim_requests WHERE item_id = $1 AND requester_id = $2 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    [itemId, viewer.id]
  );
  if (existing.rows[0]) {
    json(res, 200, {
      claimRequest: claimFromRow(existing.rows[0]),
      message: "你已提醒过发布者确认领取，请等待对方处理"
    });
    return;
  }

  const created = await query(
    `INSERT INTO claim_requests (id, item_id, requester_id, requester_name, quantity, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [makeId("claim"), itemId, viewer.id, viewer.name, quantity]
  );
  const claimRequest = claimFromRow(created.rows[0]);
  const shouldSendEmail = item.owner_claim_email_enabled !== false;
  const emailSent = shouldSendEmail ? await sendClaimNotificationMail(item.owner_email, item, claimRequest) : false;
  // Push to item owner
  sendToUser(item.owner_id, {
    title: "有人想领取你的物品",
    body: `${viewer.name} 想领取「${item.title}」${quantity}${item.unit}`,
    data: { itemId }
  });
  json(res, 201, {
    claimRequest,
    emailSent,
    message: emailSent
      ? "已通过邮件提醒发布者确认领取，确认后会自动更新库存"
      : "已记录领取提醒；发布者可在“我的发布”中确认领取"
  });
}

async function reviewClaim(req, res, viewer, claimId, action) {
  const { rows } = await query(
    `SELECT cr.*, i.owner_id, i.quantity AS item_quantity, i.status AS item_status
     FROM claim_requests cr
     JOIN items i ON i.id = cr.item_id
     WHERE cr.id = $1`,
    [claimId]
  );
  const claim = rows[0];
  if (!claim) {
    json(res, 404, { error: "CLAIM_NOT_FOUND", message: "领取提醒不存在" });
    return;
  }
  if (claim.owner_id !== viewer.id) {
    json(res, 403, { error: "FORBIDDEN", message: "只能处理自己发布物品的领取提醒" });
    return;
  }
  if (claim.status !== "pending") {
    json(res, 409, { error: "CLAIM_ALREADY_REVIEWED", message: "该领取提醒已经处理过" });
    return;
  }

  if (action === "reject") {
    const rejected = await query(
      "UPDATE claim_requests SET status = 'rejected', reviewed_at = now() WHERE id = $1 RETURNING *",
      [claimId]
    );
    json(res, 200, { claimRequest: claimFromRow(rejected.rows[0]), message: "已忽略该领取提醒" });
    return;
  }

  if (claim.item_status !== "online") {
    json(res, 409, { error: "ITEM_NOT_ONLINE", message: "该物品已不在上架状态，无法确认领取" });
    return;
  }

  const claimedQuantity = Math.min(Number(claim.quantity), Number(claim.item_quantity));
  const nextStatus = claimedQuantity >= Number(claim.item_quantity) ? "claimed" : "online";
  const reviewed = await query(
    "UPDATE claim_requests SET status = 'confirmed', reviewed_at = now() WHERE id = $1 RETURNING *",
    [claimId]
  );
  const item = await query(
    `UPDATE items
     SET quantity = GREATEST(quantity - $1, 0),
         status = CASE WHEN quantity - $1 <= 0 THEN 'claimed' ELSE 'online' END,
         reviewed_at = CASE WHEN quantity - $1 <= 0 THEN now() ELSE reviewed_at END
     WHERE id = $2 AND quantity >= $1
     RETURNING *`,
    [claimedQuantity, claim.item_id]
  );
  if (!item.rows[0]) {
    json(res, 409, { error: "INSUFFICIENT_QUANTITY", message: "物品数量不足，已被其他人领取" });
    return;
  }

  const updatedItem = item.rows[0];
  const [responseItem] = await attachOwnerTrustSummaries([itemFromRow(updatedItem, viewer, { includeRoom: true })]);
  // Push to claimer
  sendToUser(claim.requester_id, {
    title: "领取已被确认",
    body: `「${updatedItem.title}」的发布者已确认你的领取`,
    data: { itemId: claim.item_id, claimId }
  });
  json(res, 200, {
    claimRequest: claimFromRow(reviewed.rows[0]),
    item: responseItem,
    message: updatedItem.status === "claimed" ? "已确认领取，物品已自动下架" : `已确认领取，剩余 ${updatedItem.quantity}${updatedItem.unit}`
  });
}

async function submitFulfillmentReview(req, res, viewer, claimId) {
  const input = await readBody(req);
  const outcome = input.outcome === "issue" ? "issue" : "positive";
  const tags = normalizeReviewTags(input.tags, outcome);
  if (!tags.length) {
    json(res, 400, { error: "VALIDATION_ERROR", message: "请至少选择一个履约标签" });
    return;
  }
  const comment = String(input.comment || "").trim().slice(0, 160);
  const { rows } = await query(
    `SELECT cr.*, i.owner_id, i.owner_name, i.title AS item_title
     FROM claim_requests cr
     JOIN items i ON i.id = cr.item_id
     WHERE cr.id = $1`,
    [claimId]
  );
  const claim = rows[0];
  if (!claim) {
    json(res, 404, { error: "CLAIM_NOT_FOUND", message: "领取记录不存在" });
    return;
  }
  if (claim.status !== "confirmed") {
    json(res, 409, { error: "CLAIM_NOT_CONFIRMED", message: "只有已确认领取后才能评价履约" });
    return;
  }
  const isOwner = claim.owner_id === viewer.id;
  const isRequester = claim.requester_id === viewer.id;
  if (!isOwner && !isRequester) {
    json(res, 403, { error: "FORBIDDEN", message: "只能评价自己参与的履约记录" });
    return;
  }
  const existing = await query(
    "SELECT id FROM fulfillment_reviews WHERE claim_id = $1 AND reviewer_id = $2 LIMIT 1",
    [claimId, viewer.id]
  );
  if (existing.rows[0]) {
    json(res, 409, { error: "REVIEW_EXISTS", message: "你已经评价过这次履约" });
    return;
  }
  const reviewerRole = isOwner ? "owner" : "requester";
  const revieweeId = isOwner ? claim.requester_id : claim.owner_id;
  const created = await query(
    `INSERT INTO fulfillment_reviews (
       id, claim_id, item_id, reviewer_id, reviewee_id, reviewer_role, outcome, tags, comment
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9)
     RETURNING *`,
    [makeId("fr"), claimId, claim.item_id, viewer.id, revieweeId, reviewerRole, outcome, tags, comment || null]
  );
  const summaries = await trustSummariesForUsers([revieweeId]);
  json(res, 201, {
    review: {
      id: created.rows[0].id,
      claimId,
      itemId: claim.item_id,
      reviewerRole,
      revieweeId,
      outcome,
      tags,
      comment,
      createdAt: created.rows[0].created_at
    },
    revieweeTrustSummary: summaries.get(revieweeId) || emptyTrustSummary(),
    message: "履约评价已记录，感谢你让互助更可信"
  });
}

async function handle(req, res, pathname, method) {
  // POST /api/items/:id/claim
  const claimMatch = pathname.match(/^\/api\/items\/([^/]+)\/claim$/);
  if (method === "POST" && claimMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    await requestClaim(req, res, viewer, claimMatch[1]);
    return true;
  }

  // POST /api/claims/:id/confirm | /api/claims/:id/reject
  const claimReviewMatch = pathname.match(/^\/api\/claims\/([^/]+)\/(confirm|reject)$/);
  if (method === "POST" && claimReviewMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    await reviewClaim(req, res, viewer, claimReviewMatch[1], claimReviewMatch[2]);
    return true;
  }

  // POST /api/claims/:id/reviews
  const fulfillmentReviewMatch = pathname.match(/^\/api\/claims\/([^/]+)\/reviews$/);
  if (method === "POST" && fulfillmentReviewMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    await submitFulfillmentReview(req, res, viewer, fulfillmentReviewMatch[1]);
    return true;
  }

  // POST /api/claims/:id/cancel — claimer cancels a pending claim
  const cancelClaimMatch = pathname.match(/^\/api\/claims\/([^/]+)\/cancel$/);
  if (method === "POST" && cancelClaimMatch) {
    const viewer = await requireVerifiedUser(req, res);
    if (!viewer) return true;
    const { rows } = await query(
      "SELECT * FROM claim_requests WHERE id = $1",
      [cancelClaimMatch[1]]
    );
    const claim = rows[0];
    if (!claim) {
      json(res, 404, { error: "CLAIM_NOT_FOUND", message: "领取提醒不存在" });
      return true;
    }
    if (claim.requester_id !== viewer.id) {
      json(res, 403, { error: "FORBIDDEN", message: "只能取消自己的领取提醒" });
      return true;
    }
    if (claim.status !== "pending") {
      json(res, 409, { error: "CLAIM_NOT_PENDING", message: "只能取消待处理的领取提醒" });
      return true;
    }
    const cancelled = await query(
      "UPDATE claim_requests SET status = 'cancelled', reviewed_at = now() WHERE id = $1 RETURNING *",
      [cancelClaimMatch[1]]
    );
    json(res, 200, {
      claimRequest: claimFromRow(cancelled.rows[0]),
      message: "已取消领取提醒"
    });
    return true;
  }

  return false;
}

module.exports = { handle };
