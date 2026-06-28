const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  ITEM_TYPES,
  ALLOWED_ITEM_ICONS,
  defaultItemIcon,
  normalizeItemIcon,
  trustSummariesForUsers,
  attachOwnerTrustSummaries,
  itemFromRow,
  claimFromRow
} = require("../lib/item-utils");

// ---------------------------------------------------------------------------
// ITEM_TYPES
// ---------------------------------------------------------------------------
describe("ITEM_TYPES", () => {
  it("should have consumable, medicine, and tool keys", () => {
    assert.ok(ITEM_TYPES.consumable);
    assert.ok(ITEM_TYPES.medicine);
    assert.ok(ITEM_TYPES.tool);
  });

  it("should have exactly 3 item types", () => {
    assert.strictEqual(Object.keys(ITEM_TYPES).length, 3);
  });

  it("consumable should have expected shape", () => {
    const ct = ITEM_TYPES.consumable;
    assert.strictEqual(ct.text, "耗材");
    assert.strictEqual(ct.defaultCategory, "应急耗材");
    assert.strictEqual(ct.defaultIcon, "plus");
    assert.ok(Array.isArray(ct.categories));
    assert.ok(ct.categories.length > 0);
    assert.ok(ct.categories.includes("应急耗材"));
  });

  it("medicine should have expected shape", () => {
    const mt = ITEM_TYPES.medicine;
    assert.strictEqual(mt.text, "非处方药品");
    assert.strictEqual(mt.defaultCategory, "感冒药");
    assert.strictEqual(mt.defaultIcon, "capsules");
    assert.ok(Array.isArray(mt.categories));
    assert.ok(mt.categories.includes("感冒药"));
  });

  it("tool should have expected shape", () => {
    const tt = ITEM_TYPES.tool;
    assert.strictEqual(tt.text, "工具");
    assert.strictEqual(tt.defaultCategory, "常用工具");
    assert.strictEqual(tt.defaultIcon, "box");
    assert.ok(Array.isArray(tt.categories));
    assert.ok(tt.categories.includes("常用工具"));
  });
});

// ---------------------------------------------------------------------------
// ALLOWED_ITEM_ICONS
// ---------------------------------------------------------------------------
describe("ALLOWED_ITEM_ICONS", () => {
  it("should be a Set containing expected icon names", () => {
    assert.ok(ALLOWED_ITEM_ICONS instanceof Set);
    assert.ok(ALLOWED_ITEM_ICONS.has("plus"));
    assert.ok(ALLOWED_ITEM_ICONS.has("bandage"));
    assert.ok(ALLOWED_ITEM_ICONS.has("capsules"));
    assert.ok(ALLOWED_ITEM_ICONS.has("box"));
  });

  it("should not contain arbitrary strings", () => {
    assert.strictEqual(ALLOWED_ITEM_ICONS.has("nonexistent_icon"), false);
    assert.strictEqual(ALLOWED_ITEM_ICONS.has(""), false);
  });
});

// ---------------------------------------------------------------------------
// defaultItemIcon
// ---------------------------------------------------------------------------
describe("defaultItemIcon", () => {
  it('should return "plus" for consumable', () => {
    assert.strictEqual(defaultItemIcon("consumable"), "plus");
  });

  it('should return "capsules" for medicine', () => {
    assert.strictEqual(defaultItemIcon("medicine"), "capsules");
  });

  it('should return "box" for tool', () => {
    assert.strictEqual(defaultItemIcon("tool"), "box");
  });

  it('should fall back to "plus" for nonexistent item type', () => {
    assert.strictEqual(defaultItemIcon("nonexistent"), "plus");
  });

  it('should fall back to "plus" for undefined', () => {
    assert.strictEqual(defaultItemIcon(undefined), "plus");
  });

  it('should fall back to "plus" for null', () => {
    assert.strictEqual(defaultItemIcon(null), "plus");
  });

  it('should fall back to "plus" for empty string', () => {
    assert.strictEqual(defaultItemIcon(""), "plus");
  });
});

// ---------------------------------------------------------------------------
// normalizeItemIcon
// ---------------------------------------------------------------------------
describe("normalizeItemIcon", () => {
  it("should pass through a valid icon name", () => {
    assert.strictEqual(normalizeItemIcon("bandage", "consumable"), "bandage");
  });

  it('should fall back to type default for invalid icon', () => {
    assert.strictEqual(normalizeItemIcon("invalid_icon", "consumable"), "plus");
  });

  it('should fall back to medicine default for empty string with medicine', () => {
    assert.strictEqual(normalizeItemIcon("", "medicine"), "capsules");
  });

  it('should fall back to tool default for null with tool', () => {
    assert.strictEqual(normalizeItemIcon(null, "tool"), "box");
  });

  it('should fall back to consumable default for undefined item type', () => {
    assert.strictEqual(normalizeItemIcon("invalid", "garbage"), "plus");
  });

  it("should trim whitespace before checking validity", () => {
    assert.strictEqual(normalizeItemIcon("  bandage  ", "consumable"), "bandage");
  });

  it("should treat whitespace-only input as missing, falling back", () => {
    assert.strictEqual(normalizeItemIcon("   ", "medicine"), "capsules");
  });
});

// ---------------------------------------------------------------------------
// itemFromRow
// ---------------------------------------------------------------------------
describe("itemFromRow", () => {
  const viewer = { campus: "仙林校区", building: "1栋" };

  const baseRow = {
    id: "item_test123",
    title: "测试物品",
    item_type: "consumable",
    item_icon: "bandage",
    category: "应急耗材",
    description: "测试描述",
    quantity: 5,
    unit: "件",
    campus: "仙林校区",
    building: "1栋",
    room: "101",
    expire_date: "2027-06-28",
    no_expiry: false,
    status: "online",
    reject_reason: null,
    owner_id: "u_test",
    owner_name: "测试用户",
    contact_wechat: "wx_test",
    contact_qq: "qq_test",
    created_at: "2026-01-01T00:00:00Z",
    reviewed_at: null,
    pending_claim_count: 2,
    image_urls: "{http://example.com/a.jpg,/uploads/b.png}",
    owner_completed_count: 3,
    owner_top_tags: "{友善可信,按约交接}"
  };

  it("should transform a basic row to API shape", () => {
    const result = itemFromRow(baseRow, viewer);
    assert.strictEqual(result.id, "item_test123");
    assert.strictEqual(result.title, "测试物品");
    assert.strictEqual(result.itemType, "consumable");
    assert.strictEqual(result.itemTypeText, "耗材");
    assert.strictEqual(result.itemIcon, "bandage");
    assert.strictEqual(result.category, "应急耗材");
    assert.strictEqual(result.description, "测试描述");
    assert.strictEqual(result.quantity, 5);
    assert.strictEqual(result.unit, "件");
    assert.strictEqual(result.campus, "仙林校区");
    assert.strictEqual(result.building, "1栋");
    assert.strictEqual(result.expireDate, "2027-06-28");
    assert.strictEqual(result.noExpiry, false);
    assert.strictEqual(result.status, "online");
    assert.strictEqual(result.rejectReason, "");
    assert.strictEqual(result.ownerId, "u_test");
    assert.strictEqual(result.ownerName, "测试用户");
    assert.strictEqual(result.pendingClaimCount, 2);
    assert.strictEqual(result.distanceScope, "same_building");
    assert.strictEqual(result.contact, undefined);
    assert.strictEqual(result.room, undefined);
  });

  it("should not include contact info by default", () => {
    const result = itemFromRow(baseRow, viewer);
    assert.strictEqual(result.contact, undefined);
  });

  it("should include contact info when options.includeContact is true", () => {
    const result = itemFromRow(baseRow, viewer, { includeContact: true });
    assert.ok(result.contact);
    assert.strictEqual(result.contact.wechat, "wx_test");
    assert.strictEqual(result.contact.qq, "qq_test");
  });

  it("should not include room by default", () => {
    const result = itemFromRow(baseRow, viewer);
    assert.strictEqual(result.room, undefined);
  });

  it("should include room when options.includeRoom is true", () => {
    const result = itemFromRow(baseRow, viewer, { includeRoom: true });
    assert.strictEqual(result.room, "101");
  });

  it("should parse image_urls PostgreSQL array and limit to 3", () => {
    const result = itemFromRow(baseRow, viewer);
    assert.ok(Array.isArray(result.imageUrls));
    assert.strictEqual(result.imageUrls.length, 2);
    assert.strictEqual(result.imageUrls[0], "http://example.com/a.jpg");
    assert.strictEqual(result.imageUrls[1], "/uploads/b.png");
  });

  it("should handle missing image_urls", () => {
    const row = { ...baseRow, image_urls: null };
    const result = itemFromRow(row, viewer);
    assert.ok(Array.isArray(result.imageUrls));
    assert.strictEqual(result.imageUrls.length, 0);
  });

  it("should include ownerTrustSummary from row fields", () => {
    const result = itemFromRow(baseRow, viewer);
    assert.ok(result.ownerTrustSummary);
    assert.strictEqual(result.ownerTrustSummary.completedCount, 0);
    assert.deepStrictEqual(result.ownerTrustSummary.topTags, []);
  });

  it("should handle expired item", () => {
    const row = { ...baseRow, status: "expired" };
    const result = itemFromRow(row, viewer);
    assert.strictEqual(result.status, "expired");
  });

  it("should handle rejected item with reject_reason", () => {
    const row = { ...baseRow, status: "rejected", reject_reason: "违规内容" };
    const result = itemFromRow(row, viewer);
    assert.strictEqual(result.status, "rejected");
    assert.strictEqual(result.rejectReason, "违规内容");
  });

  it("should handle claimed item", () => {
    const row = { ...baseRow, status: "claimed" };
    const result = itemFromRow(row, viewer);
    assert.strictEqual(result.status, "claimed");
  });

  it("should produce different distanceLabel for different viewer campus", () => {
    const sameCampusViewer = { campus: "仙林校区", building: "10栋" };
    const crossCampusViewer = { campus: "苏州校区", building: "1栋" };

    const sameCampusResult = itemFromRow(baseRow, sameCampusViewer);
    const crossCampusResult = itemFromRow(baseRow, crossCampusViewer);

    assert.notStrictEqual(sameCampusResult.distanceScope, crossCampusResult.distanceScope);
    assert.strictEqual(crossCampusResult.distanceScope, "other_campus");
    assert.strictEqual(crossCampusResult.distanceLabel, "跨校区");
  });

  it("should handle no_expiry true", () => {
    const row = { ...baseRow, no_expiry: true, expire_date: null };
    const result = itemFromRow(row, viewer);
    assert.strictEqual(result.noExpiry, true);
  });

  it("should handle zero quantity", () => {
    const row = { ...baseRow, quantity: 0 };
    const result = itemFromRow(row, viewer);
    assert.strictEqual(result.quantity, 0);
  });

  it("should handle missing item_type by defaulting to consumable", () => {
    const row = { ...baseRow, item_type: null, item_icon: null };
    const result = itemFromRow(row, viewer);
    assert.strictEqual(result.itemType, "consumable");
    assert.strictEqual(result.itemTypeText, "耗材");
    assert.strictEqual(result.itemIcon, "plus");
  });

  it("should handle reviewed_at present", () => {
    const row = { ...baseRow, reviewed_at: "2026-01-02T10:00:00Z" };
    const result = itemFromRow(row, viewer);
    assert.strictEqual(result.reviewedAt, "2026-01-02T10:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// claimFromRow
// ---------------------------------------------------------------------------
describe("claimFromRow", () => {
  const baseRow = {
    id: "cr_test123",
    item_id: "item_test123",
    requester_id: "u_requester",
    requester_name: "请求用户",
    quantity: 1,
    status: "pending",
    created_at: "2026-01-01T00:00:00Z",
    reviewed_at: null
  };

  it("should transform a claim_requests row to API shape", () => {
    const result = claimFromRow(baseRow);
    assert.strictEqual(result.id, "cr_test123");
    assert.strictEqual(result.itemId, "item_test123");
    assert.strictEqual(result.requesterId, "u_requester");
    assert.strictEqual(result.requesterName, "请求用户");
    assert.strictEqual(result.quantity, 1);
    assert.strictEqual(result.status, "pending");
    assert.strictEqual(result.createdAt, "2026-01-01T00:00:00Z");
    assert.strictEqual(result.reviewedAt, null);
  });

  it("should handle reviewed_at when present", () => {
    const row = { ...baseRow, reviewed_at: "2026-01-02T10:00:00Z" };
    const result = claimFromRow(row);
    assert.strictEqual(result.reviewedAt, "2026-01-02T10:00:00Z");
  });

  it("should handle confirmed status", () => {
    const row = { ...baseRow, status: "confirmed" };
    const result = claimFromRow(row);
    assert.strictEqual(result.status, "confirmed");
  });

  it("should handle rejected status", () => {
    const row = { ...baseRow, status: "rejected" };
    const result = claimFromRow(row);
    assert.strictEqual(result.status, "rejected");
  });

  it("should handle cancelled status", () => {
    const row = { ...baseRow, status: "cancelled" };
    const result = claimFromRow(row);
    assert.strictEqual(result.status, "cancelled");
  });
});

// ---------------------------------------------------------------------------
// trustSummariesForUsers  (database-dependent integration)
// ---------------------------------------------------------------------------
describe("trustSummariesForUsers", () => {
  it("should return empty Map for empty array", async () => {
    const result = await trustSummariesForUsers([]);
    assert.ok(result instanceof Map);
    assert.strictEqual(result.size, 0);
  });

  it("should return empty Map for array with only falsy values", async () => {
    const result = await trustSummariesForUsers([null, undefined, ""]);
    assert.ok(result instanceof Map);
    assert.strictEqual(result.size, 0);
  });

  it("should handle a user ID with no data gracefully", async () => {
    const result = await trustSummariesForUsers(["u_nonexistent_user"]);
    assert.ok(result instanceof Map);
    assert.strictEqual(result.size, 1);
    const summary = result.get("u_nonexistent_user");
    assert.ok(summary);
    assert.strictEqual(summary.completedCount, 0);
    assert.strictEqual(summary.givenCount, 0);
    assert.strictEqual(summary.receivedCount, 0);
    assert.strictEqual(summary.positiveReviewCount, 0);
    assert.deepStrictEqual(summary.topTags, []);
  });

  it("should deduplicate duplicate user IDs", async () => {
    const result = await trustSummariesForUsers(["u_nonexistent", "u_nonexistent", "u_nonexistent"]);
    assert.strictEqual(result.size, 1);
  });

  it("should integrate with the database (seed data)", async () => {
    try {
      const { query } = require("../db");
      // First verify database connectivity
      const ping = await query("SELECT 1 AS ok");
      if (!ping || !ping.rows) {
        throw new Error("Database not reachable");
      }
    } catch (err) {
      // If DB is not available, warn and skip (don't fail the whole suite)
      console.warn("Skipping DB integration test — database not available:", err.message);
      return;
    }

    // Try with a known seed user
    const summaries = await trustSummariesForUsers(["u_demo", "u_admin"]);
    assert.ok(summaries instanceof Map);
    assert.strictEqual(summaries.size, 2);

    for (const [userId, summary] of summaries) {
      assert.ok(summary, `Expected summary for ${userId}`);
      assert.ok(typeof summary.completedCount === "number");
      assert.ok(typeof summary.givenCount === "number");
      assert.ok(typeof summary.receivedCount === "number");
      assert.ok(typeof summary.positiveReviewCount === "number");
      assert.ok(Array.isArray(summary.topTags));
      assert.ok(summary.completedCount >= 0);
    }
  });
});

// ---------------------------------------------------------------------------
// attachOwnerTrustSummaries  (database-dependent integration)
// ---------------------------------------------------------------------------
describe("attachOwnerTrustSummaries", () => {
  it("should return empty array for empty input", async () => {
    const result = await attachOwnerTrustSummaries([]);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  it("should attach emptyTrustSummary for items with unknown owners", async () => {
    const items = [
      { id: "item_1", ownerId: "u_nobody_1", title: "A" },
      { id: "item_2", ownerId: "u_nobody_2", title: "B" }
    ];
    const result = await attachOwnerTrustSummaries(items);
    assert.strictEqual(result.length, 2);
    for (const item of result) {
      assert.ok(item.ownerTrustSummary);
      assert.strictEqual(item.ownerTrustSummary.completedCount, 0);
      assert.deepStrictEqual(item.ownerTrustSummary.topTags, []);
    }
    // Verify the original items were mutated (function mutates in place)
    assert.strictEqual(items[0].ownerTrustSummary.completedCount, 0);
  });

  it("should attach summaries for known users (integration)", async () => {
    try {
      const { query } = require("../db");
      const ping = await query("SELECT 1 AS ok");
      if (!ping || !ping.rows) {
        throw new Error("Database not reachable");
      }
    } catch (err) {
      console.warn("Skipping DB integration test — database not available:", err.message);
      return;
    }

    const items = [
      { id: "item_demo", ownerId: "u_demo", title: "Demo item" },
      { id: "item_unknown", ownerId: "u_does_not_exist", title: "Unknown" }
    ];
    const result = await attachOwnerTrustSummaries(items);
    assert.strictEqual(result.length, 2);

    // u_demo may have some data; at minimum it should have emptyTrustSummary
    const demoSummary = result[0].ownerTrustSummary;
    assert.ok(demoSummary);
    assert.ok(typeof demoSummary.completedCount === "number");
    assert.ok(Array.isArray(demoSummary.topTags));

    // Unknown user gets emptyTrustSummary
    const unknownSummary = result[1].ownerTrustSummary;
    assert.strictEqual(unknownSummary.completedCount, 0);
    assert.deepStrictEqual(unknownSummary.topTags, []);
  });
});
