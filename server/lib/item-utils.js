const { query } = require("../db");
const { proximityForItem } = require("../proximity");
const { emptyTrustSummary, parsePgArray, dateOnly } = require("./util");

const ITEM_TYPES = {
  consumable: {
    text: "耗材",
    defaultCategory: "应急耗材",
    defaultIcon: "plus",
    categories: ["应急耗材", "退烧降温", "消毒护理", "外伤处理", "防护用品", "其他耗材"]
  },
  medicine: {
    text: "非处方药品",
    defaultCategory: "感冒药",
    defaultIcon: "capsules",
    categories: ["感冒药", "退烧药", "过敏药", "肠胃药", "其他非处方药"]
  },
  tool: {
    text: "工具",
    defaultCategory: "常用工具",
    defaultIcon: "box",
    categories: ["常用工具", "维修工具", "手工工具", "清洁工具", "其他工具"]
  }
};
const ALLOWED_ITEM_ICONS = new Set([
  "plus",
  "bandage",
  "notesMedical",
  "kitMedical",
  "capsules",
  "pills",
  "tablets",
  "prescriptionBottleMedical",
  "temperatureHalf",
  "maskFace",
  "shieldVirus",
  "pumpMedical",
  "bottleDroplet",
  "box",
  "boxOpen",
  "droplet",
  "handHoldingMedical",
  "heartPulse",
  "syringe",
  "soap"
]);

function defaultItemIcon(itemType) {
  return ITEM_TYPES[itemType]?.defaultIcon || ITEM_TYPES.consumable.defaultIcon;
}

function normalizeItemIcon(input, itemType) {
  const value = String(input || "").trim();
  return ALLOWED_ITEM_ICONS.has(value) ? value : defaultItemIcon(itemType);
}

function itemFromRow(row, viewer, options = {}) {
  const includeContact = Boolean(options.includeContact);
  const includeRoom = Boolean(options.includeRoom);
  const itemType = row.item_type || "consumable";
  const proximity = proximityForItem(row, viewer);

  return {
    id: row.id,
    title: row.title,
    itemType,
    itemTypeText: ITEM_TYPES[itemType]?.text || "耗材",
    itemIcon: row.item_icon || defaultItemIcon(itemType),
    imageUrls: parsePgArray(row.image_urls).slice(0, 3),
    category: row.category,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    campus: row.campus,
    building: row.building,
    room: includeRoom ? row.room || "" : undefined,
    expireDate: dateOnly(row.expire_date),
    noExpiry: Boolean(row.no_expiry),
    status: row.status,
    rejectReason: row.reject_reason || "",
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerTrustSummary: emptyTrustSummary(),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    pendingClaimCount: Number(row.pending_claim_count || 0),
    distanceScope: proximity.scope,
    distanceLabel: proximity.label,
    contact: includeContact
      ? {
          wechat: row.contact_wechat,
          qq: row.contact_qq
        }
      : undefined
  };
}

async function trustSummariesForUsers(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const summaries = new Map(ids.map(id => [id, emptyTrustSummary()]));
  if (!ids.length) {
    return summaries;
  }

  const completed = await query(
    `SELECT participant_id,
            SUM(given_count)::int AS given_count,
            SUM(received_count)::int AS received_count
     FROM (
       SELECT i.owner_id AS participant_id, COUNT(DISTINCT cr.id)::int AS given_count, 0::int AS received_count
       FROM claim_requests cr
       JOIN items i ON i.id = cr.item_id
       WHERE cr.status = 'confirmed' AND i.owner_id = ANY($1::text[])
       GROUP BY i.owner_id
       UNION ALL
       SELECT cr.requester_id AS participant_id, 0::int AS given_count, COUNT(DISTINCT cr.id)::int AS received_count
       FROM claim_requests cr
       WHERE cr.status = 'confirmed' AND cr.requester_id = ANY($1::text[])
       GROUP BY cr.requester_id
     ) completed_claims
     GROUP BY participant_id`,
    [ids]
  );
  for (const row of completed.rows) {
    const summary = summaries.get(row.participant_id) || emptyTrustSummary();
    summary.givenCount = Number(row.given_count || 0);
    summary.receivedCount = Number(row.received_count || 0);
    summary.completedCount = summary.givenCount + summary.receivedCount;
    summaries.set(row.participant_id, summary);
  }

  const tags = await query(
    `SELECT reviewee_id, tag, COUNT(*)::int AS tag_count
     FROM fulfillment_reviews fr
     CROSS JOIN LATERAL unnest(fr.tags) AS review_tag(tag)
     WHERE fr.outcome = 'positive' AND fr.reviewee_id = ANY($1::text[])
     GROUP BY reviewee_id, review_tag.tag
     ORDER BY reviewee_id, tag_count DESC, tag ASC`,
    [ids]
  );
  for (const row of tags.rows) {
    const summary = summaries.get(row.reviewee_id) || emptyTrustSummary();
    if (summary.topTags.length < 3) {
      summary.topTags.push(row.tag);
    }
    summaries.set(row.reviewee_id, summary);
  }
  const reviewCounts = await query(
    `SELECT reviewee_id, COUNT(*)::int AS positive_review_count
     FROM fulfillment_reviews
     WHERE outcome = 'positive' AND reviewee_id = ANY($1::text[])
     GROUP BY reviewee_id`,
    [ids]
  );
  for (const row of reviewCounts.rows) {
    const summary = summaries.get(row.reviewee_id) || emptyTrustSummary();
    summary.positiveReviewCount = Number(row.positive_review_count || 0);
    summaries.set(row.reviewee_id, summary);
  }
  return summaries;
}

async function attachOwnerTrustSummaries(items) {
  const summaries = await trustSummariesForUsers(items.map(item => item.ownerId));
  for (const item of items) {
    item.ownerTrustSummary = summaries.get(item.ownerId) || emptyTrustSummary();
  }
  return items;
}

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

module.exports = { ITEM_TYPES, ALLOWED_ITEM_ICONS, defaultItemIcon, normalizeItemIcon, trustSummariesForUsers, attachOwnerTrustSummaries, itemFromRow, claimFromRow };
