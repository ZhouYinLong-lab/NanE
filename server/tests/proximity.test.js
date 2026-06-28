const { describe, it } = require("node:test");
const assert = require("node:assert");

const { dormGroupId, proximityForItem, sortByProximity } = require("../proximity");

describe("dormGroupId", () => {
  describe("仙林校区", () => {
    it("should return xianlin-1 for buildings 1-5", () => {
      assert.strictEqual(dormGroupId("仙林校区", "1栋"), "xianlin-1");
      assert.strictEqual(dormGroupId("仙林校区", "5栋"), "xianlin-1");
    });

    it("should return xianlin-2 for buildings 6-11", () => {
      assert.strictEqual(dormGroupId("仙林校区", "6栋"), "xianlin-2");
      assert.strictEqual(dormGroupId("仙林校区", "11栋"), "xianlin-2");
    });

    it("should return xianlin-3 for buildings 12-15 and 28-30", () => {
      assert.strictEqual(dormGroupId("仙林校区", "12栋"), "xianlin-3");
      assert.strictEqual(dormGroupId("仙林校区", "15栋"), "xianlin-3");
      assert.strictEqual(dormGroupId("仙林校区", "28栋"), "xianlin-3");
      assert.strictEqual(dormGroupId("仙林校区", "30栋"), "xianlin-3");
    });

    it("should return xianlin-0 for buildings 16-24, 26, 27", () => {
      assert.strictEqual(dormGroupId("仙林校区", "16栋"), "xianlin-0");
      assert.strictEqual(dormGroupId("仙林校区", "24栋"), "xianlin-0");
      assert.strictEqual(dormGroupId("仙林校区", "26栋"), "xianlin-0");
      assert.strictEqual(dormGroupId("仙林校区", "27栋"), "xianlin-0");
    });

    it("should return xianlin-4 for building 25", () => {
      assert.strictEqual(dormGroupId("仙林校区", "25栋"), "xianlin-4");
    });

    it("should handle building numbers with/without 栋 suffix", () => {
      assert.strictEqual(dormGroupId("仙林校区", "1栋"), dormGroupId("仙林校区", "1"));
    });

    it("should handle campus name with/without 校区 suffix and normalize", () => {
      assert.strictEqual(dormGroupId("仙林校区", "1栋"), dormGroupId("仙林", "1栋"));
    });

    it("should return empty string for unknown building", () => {
      assert.strictEqual(dormGroupId("仙林校区", "999栋"), "");
    });
  });

  describe("苏州校区", () => {
    it("should return suzhou-仁园 for 仁园甲", () => {
      assert.strictEqual(dormGroupId("苏州校区", "仁园甲"), "suzhou-仁园");
    });

    it("should return suzhou-仁园 for 仁园己 (last letter)", () => {
      assert.strictEqual(dormGroupId("苏州校区", "仁园己"), "suzhou-仁园");
    });

    it("should return suzhou-知园 for 知园丙", () => {
      assert.strictEqual(dormGroupId("苏州校区", "知园丙"), "suzhou-知园");
    });

    it("should return suzhou-真园 for 真园甲", () => {
      assert.strictEqual(dormGroupId("苏州校区", "真园甲"), "suzhou-真园");
    });

    it("should return empty string for unrecognized garden", () => {
      assert.strictEqual(dormGroupId("苏州校区", "桃源甲"), "");
    });

    it("should return empty string for garden with wrong letter", () => {
      // 真园 only has [甲], so 真园乙 should not match
      assert.strictEqual(dormGroupId("苏州校区", "真园乙"), "");
    });
  });

  describe("浦口校区", () => {
    it("should return pukou-0 for buildings 1-6", () => {
      assert.strictEqual(dormGroupId("浦口校区", "1栋"), "pukou-0");
      assert.strictEqual(dormGroupId("浦口校区", "6栋"), "pukou-0");
    });

    it("should return pukou-1 for buildings 7-8", () => {
      assert.strictEqual(dormGroupId("浦口校区", "7栋"), "pukou-1");
      assert.strictEqual(dormGroupId("浦口校区", "8栋"), "pukou-1");
    });

    it("should return pukou-7 for buildings 26-29", () => {
      assert.strictEqual(dormGroupId("浦口校区", "26栋"), "pukou-7");
      assert.strictEqual(dormGroupId("浦口校区", "29栋"), "pukou-7");
    });

    it("should return empty string for unknown building", () => {
      assert.strictEqual(dormGroupId("浦口校区", "99栋"), "");
    });
  });

  it("should return empty string for unrecognized campus", () => {
    assert.strictEqual(dormGroupId("北京校区", "1栋"), "");
  });

  it("should handle empty building gracefully", () => {
    assert.strictEqual(dormGroupId("仙林校区", ""), "");
    assert.strictEqual(dormGroupId("仙林校区", null), "");
    assert.strictEqual(dormGroupId("仙林校区", undefined), "");
  });
});

describe("proximityForItem", () => {
  it("should return rank 0 for same building and same campus", () => {
    const result = proximityForItem({ campus: "仙林校区", building: "1栋" }, { campus: "仙林校区", building: "1栋" });
    assert.strictEqual(result.rank, 0);
    assert.strictEqual(result.scope, "same_building");
  });

  it("should return rank 0 for same building with normalized campus spelling", () => {
    // Both "6栋" — sameBuilding passes because normalizeText yields "6栋" === "6栋"
    const result = proximityForItem({ campus: "仙林", building: "6栋" }, { campus: "仙林校区", building: "6栋" });
    assert.strictEqual(result.rank, 0);
    assert.strictEqual(result.scope, "same_building");
  });

  it("should return rank 1 for same dorm group", () => {
    // 1栋 and 2栋 are both in group 1 (xianlin-1)
    const result = proximityForItem({ campus: "仙林校区", building: "1栋" }, { campus: "仙林校区", building: "2栋" });
    assert.strictEqual(result.rank, 1);
    assert.strictEqual(result.scope, "same_dorm_group");
  });

  it("should return rank 2 for same campus, different dorm group", () => {
    // 1栋 (group 1) vs 6栋 (group 2)
    const result = proximityForItem({ campus: "仙林校区", building: "1栋" }, { campus: "仙林校区", building: "6栋" });
    assert.strictEqual(result.rank, 2);
    assert.strictEqual(result.scope, "same_campus");
  });

  it("should return rank 3 for different campus", () => {
    const result = proximityForItem({ campus: "仙林校区", building: "1栋" }, { campus: "苏州校区", building: "仁园甲" });
    assert.strictEqual(result.rank, 3);
    assert.strictEqual(result.scope, "other_campus");
  });

  it("should not treat different building string forms as the same building", () => {
    // sameBuilding uses normalized text comparison — "1栋" and "1" are different
    const result = proximityForItem({ campus: "仙林校区", building: "1栋" }, { campus: "仙林校区", building: "1" });
    // They ARE in the same dorm group (both building 1), so rank 1, not 0
    assert.strictEqual(result.rank, 1);
    assert.strictEqual(result.scope, "same_dorm_group");
  });

  it("should handle suzhou same-building check", () => {
    const result = proximityForItem({ campus: "苏州校区", building: "仁园甲" }, { campus: "苏州校区", building: "仁园甲" });
    assert.strictEqual(result.rank, 0);
    assert.strictEqual(result.scope, "same_building");
  });

  it("should handle suzhou same-dorm-group check", () => {
    // Same garden (仁园) but different letters
    const result = proximityForItem({ campus: "苏州校区", building: "仁园甲" }, { campus: "苏州校区", building: "仁园乙" });
    assert.strictEqual(result.rank, 1);
    assert.strictEqual(result.scope, "same_dorm_group");
  });

  it("should handle pukou same-dorm-group check", () => {
    // Both in group 0 (buildings 1-6)
    const result = proximityForItem({ campus: "浦口校区", building: "1栋" }, { campus: "浦口校区", building: "3栋" });
    assert.strictEqual(result.rank, 1);
    assert.strictEqual(result.scope, "same_dorm_group");
  });

  it("should return other_campus when viewer campus is empty/unrecognized", () => {
    const result = proximityForItem({ campus: "仙林校区", building: "1栋" }, { campus: "", building: "1栋" });
    assert.strictEqual(result.rank, 3);
  });
});

describe("sortByProximity", () => {
  const viewer = { campus: "仙林校区", building: "6栋" };

  it("should put same_building items first", () => {
    const items = [
      { id: "a", campus: "仙林校区", building: "1栋", created_at: "2026-01-01" },
      { id: "b", campus: "仙林校区", building: "6栋", created_at: "2026-01-02" }
    ];
    const sorted = sortByProximity(items, viewer);
    assert.strictEqual(sorted[0].id, "b");
  });

  it("should sort by proximity rank then by created_at descending", () => {
    const items = [
      { id: "a", campus: "仙林校区", building: "1栋", created_at: "2026-02-01" },
      { id: "b", campus: "仙林校区", building: "6栋", created_at: "2026-01-01" },
      { id: "c", campus: "仙林校区", building: "6栋", created_at: "2026-03-01" }
    ];
    const sorted = sortByProximity(items, viewer);
    // same_building first (b and c), sorted by created_at desc (c then b)
    assert.strictEqual(sorted[0].id, "c");
    assert.strictEqual(sorted[1].id, "b");
    // then same_campus
    assert.strictEqual(sorted[2].id, "a");
  });

  it("should handle empty array", () => {
    assert.deepStrictEqual(sortByProximity([], viewer), []);
  });

  it("should handle single item", () => {
    const items = [{ id: "a", campus: "仙林校区", building: "6栋", created_at: "2026-01-01" }];
    const sorted = sortByProximity(items, viewer);
    assert.strictEqual(sorted.length, 1);
    assert.strictEqual(sorted[0].id, "a");
  });

  it("should not mutate the original array", () => {
    const items = [
      { id: "a", campus: "仙林校区", building: "1栋", created_at: "2026-01-01" },
      { id: "b", campus: "仙林校区", building: "6栋", created_at: "2026-01-02" }
    ];
    const sorted = sortByProximity(items, viewer);
    assert.notStrictEqual(sorted, items);
    assert.strictEqual(items[0].id, "a");
  });

  it("should produce full ordering: same_building > same_dorm_group > same_campus > other_campus", () => {
    const items = [
      { id: "other_campus", campus: "苏州校区", building: "仁园甲", created_at: "2026-01-01" },
      { id: "same_building", campus: "仙林校区", building: "6栋", created_at: "2026-01-02" },
      { id: "same_campus", campus: "仙林校区", building: "1栋", created_at: "2026-01-03" },
      { id: "same_dorm_group", campus: "仙林校区", building: "7栋", created_at: "2026-01-04" }
    ];
    const sorted = sortByProximity(items, viewer);
    // 6栋 is viewer's building → same_building
    // 7栋 is in group 2 (buildings 6-11) → same_dorm_group
    // 1栋 is in group 1 → same_campus (different group)
    // 苏州校区 → other_campus
    assert.strictEqual(sorted[0].id, "same_building");
    assert.strictEqual(sorted[1].id, "same_dorm_group");
    assert.strictEqual(sorted[2].id, "same_campus");
    assert.strictEqual(sorted[3].id, "other_campus");
  });
});
