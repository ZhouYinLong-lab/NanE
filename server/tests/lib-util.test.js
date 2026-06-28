const { describe, it } = require("node:test");
const assert = require("node:assert");

const { parsePgArray, escapeHtml, pick, emptyTrustSummary, normalizeImageUrls, normalizeReviewTags, dateOnly, REVIEW_TAGS, ISSUE_REVIEW_TAGS } = require("../lib/util");

describe("parsePgArray", () => {
  it("should parse PostgreSQL array string with multiple elements", () => {
    assert.deepStrictEqual(parsePgArray("{a,b,c}"), ["a", "b", "c"]);
  });

  it("should parse empty PostgreSQL array", () => {
    assert.deepStrictEqual(parsePgArray("{}"), []);
  });

  it("should return empty array for null", () => {
    assert.deepStrictEqual(parsePgArray(null), []);
  });

  it("should return empty array for undefined", () => {
    assert.deepStrictEqual(parsePgArray(undefined), []);
  });

  it("should pass through existing array unchanged", () => {
    assert.deepStrictEqual(parsePgArray(["a", "b"]), ["a", "b"]);
  });

  it("should strip surrounding double-quotes from elements", () => {
    assert.deepStrictEqual(parsePgArray('{"hello world","single"}'), ["hello world", "single"]);
  });

  it("should filter out empty strings from parsed result", () => {
    // PostgreSQL sometimes produces empty elements from array_to_string etc.
    const result = parsePgArray("{a,,b}");
    assert.deepStrictEqual(result, ["a", "b"]);
  });
});

describe("escapeHtml", () => {
  it("should escape < and >", () => {
    assert.strictEqual(escapeHtml("<script>alert('x')</script>"), "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  });

  it("should escape double quotes", () => {
    assert.strictEqual(escapeHtml('"quote"'), "&quot;quote&quot;");
  });

  it("should escape ampersands", () => {
    assert.strictEqual(escapeHtml("a&b"), "a&amp;b");
  });

  it("should escape single quotes", () => {
    assert.strictEqual(escapeHtml("it's"), "it&#39;s");
  });

  it("should return empty string for null", () => {
    assert.strictEqual(escapeHtml(null), "");
  });

  it("should return empty string for undefined", () => {
    assert.strictEqual(escapeHtml(undefined), "");
  });

  it("should return empty string for empty input", () => {
    assert.strictEqual(escapeHtml(""), "");
  });

  it("should leave safe text unchanged", () => {
    assert.strictEqual(escapeHtml("Hello World"), "Hello World");
    assert.strictEqual(escapeHtml("123"), "123");
  });
});

describe("pick", () => {
  it("should return first matching key value", () => {
    assert.strictEqual(pick({ a: "1", b: "2" }, ["b", "a"]), "2");
  });

  it("should skip undefined, null, and empty string values", () => {
    assert.strictEqual(pick({ a: undefined, b: null, c: "", d: "real" }, ["a", "b", "c", "d"]), "real");
  });

  it("should return fallback when no key matches", () => {
    assert.strictEqual(pick({}, ["a"], "fallback"), "fallback");
  });

  it("should return empty string fallback by default", () => {
    assert.strictEqual(pick({}, ["a"]), "");
  });

  it("should handle null source", () => {
    assert.strictEqual(pick(null, ["a"], "fallback"), "fallback");
  });

  it("should handle empty keys array", () => {
    assert.strictEqual(pick({ a: "1" }, [], "fallback"), "fallback");
  });
});

describe("emptyTrustSummary", () => {
  it("should return object with all zero counts", () => {
    const summary = emptyTrustSummary();
    assert.deepStrictEqual(summary, { completedCount: 0, givenCount: 0, receivedCount: 0, positiveReviewCount: 0, topTags: [] });
  });

  it("should return a new object on each call", () => {
    const a = emptyTrustSummary();
    const b = emptyTrustSummary();
    assert.notStrictEqual(a, b);
  });
});

describe("normalizeImageUrls", () => {
  it("should keep valid http/https URLs", () => {
    const result = normalizeImageUrls(["https://example.com/a.jpg", "/uploads/x.png", "invalid"]);
    assert.deepStrictEqual(result, ["https://example.com/a.jpg", "/uploads/x.png"]);
  });

  it("should return empty array for null input", () => {
    assert.deepStrictEqual(normalizeImageUrls(null), []);
  });

  it("should return empty array for undefined input", () => {
    assert.deepStrictEqual(normalizeImageUrls(undefined), []);
  });

  it("should return empty array for empty array", () => {
    assert.deepStrictEqual(normalizeImageUrls([]), []);
  });

  it("should reject non-matching URLs", () => {
    assert.deepStrictEqual(normalizeImageUrls(["ftp://example.com/a.jpg", "data:image/png;base64,abc"]), []);
  });

  it("should deduplicate URLs", () => {
    const result = normalizeImageUrls(["/uploads/a.png", "/uploads/a.png", "/uploads/b.png"]);
    assert.deepStrictEqual(result, ["/uploads/a.png", "/uploads/b.png"]);
  });

  it("should trim whitespace from URLs", () => {
    const result = normalizeImageUrls(["  /uploads/x.png  "]);
    assert.deepStrictEqual(result, ["/uploads/x.png"]);
  });

  it("should limit to 3 URLs", () => {
    const urls = ["/uploads/1.png", "/uploads/2.png", "/uploads/3.png", "/uploads/4.png"];
    const result = normalizeImageUrls(urls);
    assert.strictEqual(result.length, 3);
  });

  it("should truncate URLs longer than 500 characters", () => {
    const longUrl = "/uploads/" + "a".repeat(500) + ".png";
    const result = normalizeImageUrls([longUrl]);
    assert.ok(result[0].length <= 500);
  });

  it("should handle mixed valid/invalid gracefully", () => {
    const result = normalizeImageUrls(["/uploads/good.jpg", null, undefined, "", "https://valid.com/img.jpg"]);
    assert.deepStrictEqual(result, ["/uploads/good.jpg", "https://valid.com/img.jpg"]);
  });
});

describe("normalizeReviewTags", () => {
  it("should keep only valid positive tags", () => {
    const result = normalizeReviewTags(["沟通顺畅", "invalid_tag", "友善可信"]);
    assert.deepStrictEqual(result, ["沟通顺畅", "友善可信"]);
  });

  it("should keep valid issue tags when outcome is 'issue'", () => {
    const result = normalizeReviewTags(["物品不符", "invalid_tag"], "issue");
    assert.deepStrictEqual(result, ["物品不符"]);
  });

  it("should deduplicate tags", () => {
    const result = normalizeReviewTags(["沟通顺畅", "沟通顺畅", "友善可信"]);
    assert.deepStrictEqual(result, ["沟通顺畅", "友善可信"]);
  });

  it("should return empty array for null input", () => {
    assert.deepStrictEqual(normalizeReviewTags(null), []);
  });

  it("should return empty array for undefined input", () => {
    assert.deepStrictEqual(normalizeReviewTags(undefined), []);
  });

  it("should return empty array for empty array", () => {
    assert.deepStrictEqual(normalizeReviewTags([]), []);
  });

  it("should limit to 5 tags", () => {
    const allTags = REVIEW_TAGS.slice(); // 5 tags
    const result = normalizeReviewTags([...allTags, ...allTags]);
    assert.strictEqual(result.length, 5);
  });

  it("should use positive REVIEW_TAGS by default", () => {
    const result = normalizeReviewTags(["物品不符"]);
    assert.deepStrictEqual(result, []);
  });

  it("should use ISSUE_REVIEW_TAGS when outcome is 'issue'", () => {
    const result = normalizeReviewTags(["沟通顺畅", "联系方式无效"], "issue");
    assert.deepStrictEqual(result, ["联系方式无效"]);
  });
});

describe("dateOnly", () => {
  it("should format a Date object as YYYY-MM-DD", () => {
    assert.strictEqual(dateOnly(new Date("2026-01-15")), "2026-01-15");
  });

  it("should handle a Date at different times on the same day", () => {
    const d = new Date("2026-06-28T23:59:59.999Z");
    assert.strictEqual(dateOnly(d), "2026-06-28");
  });

  it("should truncate string values to first 10 characters", () => {
    assert.strictEqual(dateOnly("2026-01-15T12:00:00Z"), "2026-01-15");
  });

  it("should return empty string for null", () => {
    assert.strictEqual(dateOnly(null), "");
  });

  it("should return empty string for undefined", () => {
    assert.strictEqual(dateOnly(undefined), "");
  });

  it("should return empty string for empty string", () => {
    assert.strictEqual(dateOnly(""), "");
  });

  it("should handle short date strings", () => {
    assert.strictEqual(dateOnly("2026-01"), "2026-01");
  });
});
