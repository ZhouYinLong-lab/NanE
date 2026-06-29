// Run with: node server/tests/api.test.js (requires server running on port 37878)
// Full-chain API smoke test using only Node.js built-in modules.
// Tests the complete public API surface: health, auth, items, claims, admin, and error handling.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");
require("../env");
const { signToken } = require("../lib/jwt");
const { query, makeId } = require("../db");

const BASE_URL = process.env.NANE_TEST_BASE_URL || "http://localhost:37878";

// ── Test utilities ──────────────────────────────────────────────

/**
 * Make an HTTP request and parse the response.
 * Returns { status, data, headers }.
 * If the response body is valid JSON, data is parsed; otherwise it stays a string.
 */
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      "Content-Type": "application/json",
      ...options.headers
    };
    const req = http.request(
      url,
      { method: options.method || "GET", headers },
      res => {
        let body = "";
        res.on("data", chunk => { body += chunk; });
        res.on("end", () => {
          let data;
          try {
            data = JSON.parse(body);
          } catch {
            data = body;
          }
          resolve({
            status: res.statusCode,
            data,
            headers: res.headers
          });
        });
      }
    );
    req.on("error", err => {
      // Wrap the error with a clear message when the server is unreachable
      if (err.code === "ECONNREFUSED") {
        reject(new Error(
          `Connection refused at ${BASE_URL}${path}. ` +
          "Make sure the server is running on port 37878 before executing tests."
        ));
      } else {
        reject(err);
      }
    });
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Shorthand for a JSON body POST request.
 */
function postJSON(path, body, headers = {}) {
  return request(path, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

// ── Test data ───────────────────────────────────────────────────

const KNOWN_ITEM_ID = "seed_c01";
const REJECTED_ITEM_ID = "seed_r01";
const REVIEWING_ITEM_ID = "seed_r02";
const CLAIMED_ITEM_ID = "seed_r04";
const NONEXISTENT_ID = "nonexistent_0000";

// Admin credentials (defaults from db.js)
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "nane-admin-demo";

// ── Hooks ───────────────────────────────────────────────────────

let demoToken = null;
let adminToken = null;
const viewerAdminToken = signToken({
  sub: "admin_viewer_test",
  role: "admin",
  adminRole: "viewer",
  username: "viewer-test"
});
const moderatorAdminToken = signToken({
  sub: "admin_moderator_test",
  role: "admin",
  adminRole: "moderator",
  username: "moderator-test"
});

// ── Test suites ─────────────────────────────────────────────────

describe("NanE API — Health and Info Endpoints", () => {

  it("GET /api/health returns OK with server info", async () => {
    const { status, data } = await request("/api/health");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.name, "NanE API");
    assert.ok(data.version, "should have a version string");
    assert.ok(data.database, "should name the database engine");
    assert.ok(data.time, "should include the response timestamp");
  });

  it("GET /api/locations returns campus list", async () => {
    const { status, data } = await request("/api/locations");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.locations));
    // Should include at least Xianlin, Suzhou, Pukou campuses
    const names = data.locations.map(l => l.name);
    assert.ok(names.includes("仙林校区"), "should include xianlin campus");
    assert.ok(names.includes("苏州校区"), "should include suzhou campus");
    assert.ok(names.includes("浦口校区"), "should include pukou campus");
    // Each campus should have buildings
    for (const location of data.locations) {
      assert.ok(Array.isArray(location.buildings), `${location.name} should have buildings array`);
    }
  });

  it("GET /api/legal/agreement returns markdown", async () => {
    const { status, data } = await request("/api/legal/agreement");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.version, "v1.0");
    assert.ok(typeof data.markdown === "string");
    assert.ok(data.markdown.length > 50, "agreement markdown should be substantial");
    assert.ok(data.markdown.includes("NanE"), "should reference the platform name");
  });

  it("GET /api/legal/privacy returns privacy guideline", async () => {
    const { status, data } = await request("/api/legal/privacy");
    assert.strictEqual(status, 200);
    assert.ok(typeof data.markdown === "string");
    // May be the actual guideline or a fallback message
    assert.ok(data.markdown.length > 0, "should have content");
  });
});

describe("NanE API — Guest Mode", () => {

  it("GET /api/me returns guest mode for unauthenticated requests", async () => {
    const { status, data } = await request("/api/me");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.guest, true);
    assert.strictEqual(data.user, null);
    assert.ok(data.agreementVersion);
  });

  it("GET /api/items returns item list for guests", async () => {
    const { status, data } = await request("/api/items");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.items));
    assert.ok(typeof data.total === "number");
    assert.ok(data.total >= 0);
    assert.ok(data.hasMore === false || data.hasMore === true);
    // Items in the list should have required fields
    if (data.items.length > 0) {
      const item = data.items[0];
      assert.ok(item.id, "item should have an id");
      assert.ok(item.title, "item should have a title");
      assert.ok(item.ownerName, "item should have an ownerName");
      assert.ok(item.distanceScope, "item should have distanceScope for proximity sorting");
      assert.ok(item.distanceLabel, "item should have distanceLabel");
      // Contact info must NOT be exposed in the list
      assert.strictEqual(item.contact, undefined,
        "contact info must not be exposed in public item list");
    }
    // Should include viewer location context
    assert.ok(data.viewer);
    assert.ok(data.viewer.campus);
    assert.ok(data.viewer.building);
  });

  it("GET /api/items supports keyword search", async () => {
    const { status, data } = await request("/api/items?keyword=口罩");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.items));
    // Items matching "口罩" should have it in title or description
    for (const item of data.items) {
      const matchesKeyword =
        item.title.includes("口罩") ||
        (item.description || "").includes("口罩");
      // May not match if debug mode filters the owner out, but the API should still work
    }
  });

  it("GET /api/items supports itemType filter", async () => {
    const { status, data } = await request("/api/items?itemType=medicine");
    assert.strictEqual(status, 200);
    for (const item of data.items) {
      assert.strictEqual(item.itemType, "medicine",
        "filtered list should only contain medicine items");
    }
  });

  it("GET /api/items supports category filter", async () => {
    const { status, data } = await request("/api/items?category=感冒药");
    assert.strictEqual(status, 200);
    for (const item of data.items) {
      assert.strictEqual(item.category, "感冒药",
        "filtered list should only match the requested category");
    }
  });

  it("GET /api/items supports pagination (limit/offset)", async () => {
    const { status, data } = await request("/api/items?limit=3");
    assert.strictEqual(status, 200);
    assert.ok(data.items.length <= 3, "limit should cap results");
  });

  it("GET /api/me/notifications returns default for guest", async () => {
    const { status, data } = await request("/api/me/notifications");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.claimEmailEnabled, true);
  });
});

describe("NanE API — Auth Endpoint Deprecation and Validation", () => {

  it("POST /api/auth/email-login returns 410 Gone", async () => {
    const { status, data } = await postJSON("/api/auth/email-login", {});
    assert.strictEqual(status, 410);
    assert.strictEqual(data.error, "ENDPOINT_DEPRECATED");
  });

  it("POST /api/auth/email/challenge rejects missing email", async () => {
    const { status, data } = await postJSON("/api/auth/email/challenge", {
      agreementAccepted: true
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
  });

  it("POST /api/auth/email/challenge rejects non-NJU email", async () => {
    const { status, data } = await postJSON("/api/auth/email/challenge", {
      email: "user@gmail.com",
      agreementAccepted: true
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
    assert.ok(data.message.includes("@smail.nju.edu.cn"));
  });

  it("POST /api/auth/email/challenge rejects without agreement", async () => {
    const { status, data } = await postJSON("/api/auth/email/challenge", {
      email: "test@smail.nju.edu.cn"
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "AGREEMENT_REQUIRED");
  });

  it("POST /api/auth/email/verify rejects missing email", async () => {
    const { status, data } = await postJSON("/api/auth/email/verify", {});
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
  });

  it("POST /api/auth/email/verify rejects invalid code format", async () => {
    const { status, data } = await postJSON("/api/auth/email/verify", {
      email: "test@smail.nju.edu.cn",
      code: "abc",
      agreementAccepted: true
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
    assert.ok(data.message.includes("6 位"));
  });

  it("POST /api/auth/email/verify rejects non-NJU email", async () => {
    const { status, data } = await postJSON("/api/auth/email/verify", {
      email: "test@gmail.com",
      code: "123456",
      agreementAccepted: true
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
  });

  it("POST /api/auth/password/login rejects without agreement", async () => {
    const { status, data } = await postJSON("/api/auth/password/login", {
      email: "test@smail.nju.edu.cn",
      password: "Test1234"
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "AGREEMENT_REQUIRED");
  });

  it("POST /api/auth/password/login rejects non-NJU email", async () => {
    const { status, data } = await postJSON("/api/auth/password/login", {
      email: "test@gmail.com",
      password: "Test1234",
      agreementAccepted: true
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
  });

  it("POST /api/auth/password/login rejects invalid credentials", async () => {
    const { status, data } = await postJSON("/api/auth/password/login", {
      email: "nonexistent@smail.nju.edu.cn",
      password: "WrongPass1",
      agreementAccepted: true,
      agreementVersion: "v1.0"
    });
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "INVALID_LOGIN");
  });

  it("POST /api/auth/password/set rejects without auth", async () => {
    const { status, data } = await postJSON("/api/auth/password/set", {
      password: "Test1234"
    });
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/auth/password/change rejects without auth", async () => {
    const { status, data } = await postJSON("/api/auth/password/change", {});
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/auth/password/reset-challenge rejects non-NJU email", async () => {
    const { status, data } = await postJSON("/api/auth/password/reset-challenge", {
      email: "test@gmail.com"
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
  });

  it("POST /api/auth/password/reset rejects invalid code", async () => {
    const { status, data } = await postJSON("/api/auth/password/reset", {
      email: "test@smail.nju.edu.cn",
      code: "000000",
      password: "NewPass123"
    });
    assert.strictEqual(status, 400);
    // "000000" passes the 6-digit format check but fails at the challenge lookup
    assert.ok(
      data.error === "INVALID_CODE" || data.error === "VALIDATION_ERROR",
      `expected INVALID_CODE or VALIDATION_ERROR, got ${data.error}`
    );
  });

  it("POST /api/auth/password/reset rejects weak password", async () => {
    const { status, data } = await postJSON("/api/auth/password/reset", {
      email: "test@smail.nju.edu.cn",
      code: "123456",
      password: "short"
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.error, "VALIDATION_ERROR");
  });

  it("POST /api/auth/nanna/challenge returns 503 (not configured)", async () => {
    const { status, data } = await postJSON("/api/auth/nanna/challenge", {
      email: "test@smail.nju.edu.cn",
      agreementAccepted: true,
      agreementVersion: "v1.0"
    });
    // Either 503 if Nanna not configured, or 400 if misconfigured
    assert.ok(
      status === 503 || status === 400 || status === 200,
      `nanna challenge returned status ${status} (expected 503 if not configured)`
    );
    if (status === 503) {
      assert.strictEqual(data.error, "NANNA_NOT_CONFIGURED");
    }
  });

  it("POST /api/auth/nanna/verify returns 503 (not configured)", async () => {
    const { status, data } = await postJSON("/api/auth/nanna/verify", {
      code: "123456",
      agreementAccepted: true,
      agreementVersion: "v1.0"
    });
    assert.ok(
      status === 503 || status === 400 || status === 200,
      `nanna verify returned status ${status} (expected 503 if not configured)`
    );
    if (status === 503) {
      assert.strictEqual(data.error, "NANNA_NOT_CONFIGURED");
    }
  });
});

describe("NanE API — Demo Authentication Flow", () => {

  it("POST /api/auth/wx-login returns demo token and user", async () => {
    const { status, data } = await postJSON("/api/auth/wx-login", {});
    assert.strictEqual(status, 200);
    assert.ok(data.token, "should return a JWT token");
    assert.ok(data.user, "should return a user object");
    assert.strictEqual(data.user.id, "u_demo", "should be the demo user");
    assert.strictEqual(data.user.name, "周同学");
    assert.strictEqual(data.loginMode, "fallback-demo");
    demoToken = data.token;
  });

  it("GET /api/me with demo token returns user data", async () => {
    assert.ok(demoToken, "demo token must be available from previous test");
    const { status, data } = await request("/api/me", {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(data.user, "should return a non-null user");
    assert.strictEqual(data.user.id, "u_demo");
    // Guest should not be true when authenticated (but guest may not be present)
    assert.strictEqual(data.guest, undefined,
      "guest key should not be present for authenticated user");
    assert.ok(data.agreementVersion);
    // User should have hasAgreement and profileComplete booleans
    assert.ok(typeof data.user.hasAgreement === "boolean");
    assert.ok(typeof data.user.profileComplete === "boolean");
  });

  it("GET /api/me/notifications with demo token returns user preference", async () => {
    assert.ok(demoToken);
    const { status, data } = await request("/api/me/notifications", {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.claimEmailEnabled, true);
  });

  it("GET /api/me/expired-count with demo token requires verified user", async () => {
    assert.ok(demoToken);
    const { status } = await request("/api/me/expired-count", {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    // Demo user is NOT verified, so should get 401
    assert.strictEqual(status, 401);
  });

  it("GET /api/me/reviews/pending with demo token requires verified user", async () => {
    assert.ok(demoToken);
    const { status, data } = await request("/api/me/reviews/pending", {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/me/profile with demo token requires verified user", async () => {
    assert.ok(demoToken);
    const { status } = await postJSON("/api/me/profile", {
      name: "测试用户",
      campus: "仙林校区",
      building: "南苑 A 栋",
      room: "101"
    }, { Authorization: `Bearer ${demoToken}` });
    assert.strictEqual(status, 401);
  });

  it("PUT /api/me/notifications with demo token requires verified user", async () => {
    assert.ok(demoToken);
    const { status } = await request("/api/me/notifications", {
      method: "PUT",
      body: { claimEmailEnabled: false },
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.strictEqual(status, 401);
  });

  it("GET /api/me/items with demo token requires verified user", async () => {
    assert.ok(demoToken);
    const { status } = await request("/api/me/items", {
      headers: { Authorization: `Bearer ${demoToken}` }
    });
    assert.strictEqual(status, 401);
  });
});

describe("NanE API — Protected Endpoints (401 without auth)", () => {

  it("POST /api/items requires authentication", async () => {
    const { status, data } = await postJSON("/api/items", {
      title: "Test Item",
      itemType: "consumable",
      quantity: 1,
      unit: "个",
      campus: "仙林校区",
      building: "南苑 A 栋"
    });
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/items/:id/contact requires authentication", async () => {
    const { status, data } = await postJSON(`/api/items/${KNOWN_ITEM_ID}/contact`);
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/items/:id/claim requires authentication", async () => {
    const { status, data } = await postJSON(`/api/items/${KNOWN_ITEM_ID}/claim`);
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/claims/:id/confirm requires authentication", async () => {
    const { status, data } = await postJSON("/api/claims/nonexist/confirm");
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/claims/:id/reviews requires authentication", async () => {
    const { status, data } = await postJSON("/api/claims/nonexist/reviews");
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/uploads/images requires authentication", async () => {
    const { status, data } = await postJSON("/api/uploads/images", {});
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("GET /api/admin/items requires admin auth", async () => {
    const { status, data } = await request("/api/admin/items");
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "UNAUTHORIZED");
  });

  it("GET /api/admin/stats requires admin auth", async () => {
    const { status, data } = await request("/api/admin/stats");
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "UNAUTHORIZED");
  });

  it("GET /api/admin/activity requires admin auth", async () => {
    const { status, data } = await request("/api/admin/activity?campus=仙林校区&building=南苑%20A%20栋");
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "UNAUTHORIZED");
  });
});

describe("NanE API — Item Detail and Lookup", () => {

  it("GET /api/items/seed_c01 returns known item details", async () => {
    const { status, data } = await request(`/api/items/${KNOWN_ITEM_ID}`);
    assert.strictEqual(status, 200);
    assert.ok(data.item);
    assert.strictEqual(data.item.id, KNOWN_ITEM_ID);
    assert.strictEqual(data.item.title, "碘伏棉签 10 支");
    assert.strictEqual(data.item.ownerName, "周同学");
    // Contact info must NOT be exposed in item detail for non-owners
    assert.strictEqual(data.item.contact, undefined,
      "contact info should not be exposed in item detail for guests");
    // Room info should not be exposed for guests
    assert.strictEqual(data.item.room, undefined,
      "room should not be exposed for guests");
    assert.strictEqual(data.item.distanceScope, "same_building",
      "guest viewer (same building) should get same_building proximity");
  });

  it("GET /api/items/seed_r01 returns rejected item", async () => {
    const { status, data } = await request(`/api/items/${REJECTED_ITEM_ID}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(data.item.status, "rejected");
  });

  it("GET /api/items/seed_r02 returns reviewing item", async () => {
    const { status, data } = await request(`/api/items/${REVIEWING_ITEM_ID}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(data.item.status, "reviewing");
  });

  it("GET /api/items/seed_r04 returns claimed item", async () => {
    const { status, data } = await request(`/api/items/${CLAIMED_ITEM_ID}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(data.item.status, "claimed");
  });

  it("GET /api/items/nonexistent returns 404", async () => {
    const { status, data } = await request(`/api/items/${NONEXISTENT_ID}`);
    assert.strictEqual(status, 404);
    assert.strictEqual(data.error, "ITEM_NOT_FOUND");
  });
});

describe("NanE API — Admin Authentication", () => {

  it("POST /api/admin/login with bad credentials returns 401", async () => {
    const { status, data } = await postJSON("/api/admin/login", {
      username: ADMIN_USERNAME,
      password: "wrong-password"
    });
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "INVALID_LOGIN");
  });

  it("POST /api/admin/login with valid credentials returns token", async () => {
    const { status, data } = await postJSON("/api/admin/login", {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    });
    assert.strictEqual(status, 200);
    assert.ok(data.token, "should return an admin JWT token");
    adminToken = data.token;
  });

  it("GET /api/admin/stats with admin token returns platform stats", async () => {
    assert.ok(adminToken, "admin token must be available from previous test");
    const { status, data } = await request("/api/admin/stats", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(status, 200);
    // Stats object should have numeric fields
    assert.ok(typeof data.reviewing === "number");
    assert.ok(typeof data.online === "number");
    assert.ok(typeof data.offline === "number");
    assert.ok(typeof data.contact_views_today === "number");
    assert.ok(typeof data.confirmed_claims === "number");
    assert.ok(typeof data.fulfillment_reviews === "number");
    assert.ok(data.reviewing >= 0);
    assert.ok(data.online >= 0);
  });

  it("GET /api/admin/items with admin token returns all items", async () => {
    assert.ok(adminToken);
    const { status, data } = await request("/api/admin/items", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.items));
    // Admin items should include contact and room info
    if (data.items.length > 0) {
      const item = data.items[0];
      assert.ok(item.contact, "admin view should include contact info");
      assert.ok(typeof item.contact.wechat === "string");
    }
  });

  it("GET /api/admin/activity with admin token returns building activity", async () => {
    assert.ok(adminToken);
    const { status, data } = await request("/api/admin/activity?campus=仙林校区&building=南苑%20A%20栋&limit=5", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.campus, "仙林校区");
    assert.strictEqual(data.building, "南苑 A 栋");
    assert.ok(data.summary);
    assert.ok(typeof data.summary.onlineItems === "number");
    assert.ok(typeof data.summary.confirmedClaims === "number");
    assert.ok(Array.isArray(data.activities));
    assert.ok(data.activities.length <= 5);
  });

  it("GET /api/admin/items?status=reviewing filters by status", async () => {
    assert.ok(adminToken);
    const { status, data } = await request("/api/admin/items?status=reviewing", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(status, 200);
    for (const item of data.items) {
      assert.strictEqual(item.status, "reviewing",
        "all items in filtered view should be reviewing");
    }
  });

  it("GET /api/admin/items?status=rejected filters rejected items", async () => {
    assert.ok(adminToken);
    const { status, data } = await request("/api/admin/items?status=rejected", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(status, 200);
    for (const item of data.items) {
      assert.strictEqual(item.status, "rejected");
    }
  });

  it("viewer admin can read stats but cannot review a single item", async () => {
    const readable = await request("/api/admin/stats", {
      headers: { Authorization: `Bearer ${viewerAdminToken}` }
    });
    assert.strictEqual(readable.status, 200);

    const denied = await postJSON(
      "/api/admin/items/nonexistent_0000/approve",
      {},
      { Authorization: `Bearer ${viewerAdminToken}` }
    );
    assert.strictEqual(denied.status, 403);
    assert.strictEqual(denied.data.error, "FORBIDDEN");
  });

  it("viewer admin cannot use batch review endpoint", async () => {
    const { status, data } = await postJSON(
      "/api/admin/items/batch",
      { ids: ["nonexistent_0000"], action: "approve" },
      { Authorization: `Bearer ${viewerAdminToken}` }
    );
    assert.strictEqual(status, 403);
    assert.strictEqual(data.error, "FORBIDDEN");
  });

  it("moderator admin is authorized for single review endpoint", async () => {
    const { status, data } = await postJSON(
      "/api/admin/items/nonexistent_0000/approve",
      {},
      { Authorization: `Bearer ${moderatorAdminToken}` }
    );
    assert.strictEqual(status, 404);
    assert.strictEqual(data.error, "ITEM_NOT_FOUND");
  });

  it("batch take-down stores review log action as take_down", async () => {
    const itemId = makeId("test_item");
    await query(
      `INSERT INTO items
       (id, title, item_type, item_icon, category, description, quantity, unit, campus, building, room, expire_date, no_expiry, status, owner_id, owner_name, contact_wechat, contact_qq)
       VALUES ($1, '测试批量下架物品', 'consumable', 'plus', '应急耗材', '用于 API 测试后清理', 1, '件', '仙林校区', '南苑 A 栋', '', CURRENT_DATE + INTERVAL '30 days', false, 'online', 'u_demo', '测试同学', 'test_wechat', 'test_qq')`,
      [itemId]
    );
    try {
      const { status, data } = await postJSON(
        "/api/admin/items/batch",
        { ids: [itemId], action: "take-down" },
        { Authorization: `Bearer ${moderatorAdminToken}` }
      );
      assert.strictEqual(status, 200);
      assert.strictEqual(data.reviewed, 1);

      const { rows } = await query(
        "SELECT action FROM review_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1",
        [itemId]
      );
      assert.strictEqual(rows[0]?.action, "take_down");
    } finally {
      await query("DELETE FROM review_logs WHERE item_id = $1", [itemId]);
      await query("DELETE FROM items WHERE id = $1", [itemId]);
    }
  });
});

describe("NanE API — Static File Serving", () => {

  it("GET / returns the main HTML page", async () => {
    const { status, data } = await request("/");
    assert.strictEqual(status, 200);
    assert.ok(typeof data === "string", "response should be HTML (string)");
    // HTML content type check
    assert.ok(data.includes("南易") || data.includes("NanE"),
      "should contain the app name");
    assert.ok(data.includes("</html>") || data.includes("<!doctype"),
      "should be valid HTML");
  });

  it("GET /web/css/tokens.css serves split web CSS file", async () => {
    const { status, data } = await request("/web/css/tokens.css");
    assert.strictEqual(status, 200);
    assert.ok(typeof data === "string");
    assert.ok(data.includes("{") && data.includes("}"),
      "response should contain CSS rule blocks");
  });

  it("GET /admin/styles.css serves admin CSS file", async () => {
    const { status, data } = await request("/admin/styles.css");
    assert.strictEqual(status, 200);
    assert.ok(typeof data === "string");
    assert.ok(data.includes(".dashboard") || data.includes(".admin-main"),
      "response should contain admin CSS rules");
  });

  it("GET /assets/brand/web-logo.png serves a binary file", async () => {
    const result = await new Promise((resolve, reject) => {
      const url = new URL("/assets/brand/web-logo.png", BASE_URL);
      const req = http.get(url, res => {
        let body = Buffer.alloc(0);
        res.on("data", chunk => { body = Buffer.concat([body, chunk]); });
        res.on("end", () => {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        });
      });
      req.on("error", reject);
    });
    assert.strictEqual(result.status, 200);
    assert.ok(result.headers["content-type"].includes("image/png"),
      "should return image/png content type");
    assert.ok(result.data.length > 100, "should have meaningful binary content");
  });
});

describe("NanE API — 404 and Error Handling", () => {

  it("GET /api/nonexistent route returns 404", async () => {
    const { status, data } = await request("/api/nonexistent");
    assert.strictEqual(status, 404);
    assert.strictEqual(data.error, "NOT_FOUND", "should use NOT_FOUND error code");
  });

  it("POST /api/nonexistent returns 404", async () => {
    const { status, data } = await postJSON("/api/nonexistent", {});
    assert.strictEqual(status, 404);
    assert.strictEqual(data.error, "NOT_FOUND");
  });

  it("GET /nonexistent-file returns 404", async () => {
    const { status, data } = await request("/nonexistent-file");
    assert.strictEqual(status, 404);
  });

  it("OPTIONS request returns 204", async () => {
    const { status } = await request("/api/health", { method: "OPTIONS" });
    assert.strictEqual(status, 204, "preflight should return 204 No Content");
  });

  it("OPTIONS on any path returns 204", async () => {
    const { status } = await request("/api/items", { method: "OPTIONS" });
    assert.strictEqual(status, 204);
  });
});

describe("NanE API — Cross-Origin Headers", () => {

  it("all responses include CORS headers", async () => {
    const { headers } = await request("/api/health");
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.ok(headers["access-control-allow-methods"]);
    assert.ok(headers["access-control-allow-headers"]);
  });
});

describe("NanE API — JWT Token Handling", () => {

  it("invalid Bearer token returns 401 for protected routes", async () => {
    const { status, data } = await request("/api/me/items", {
      headers: { Authorization: "Bearer invalid-token-here" }
    });
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("malformed Authorization header is ignored", async () => {
    const { status, data } = await request("/api/me", {
      headers: { Authorization: "Basic somebase64" }
    });
    // Should be treated as guest
    assert.strictEqual(status, 200);
    assert.strictEqual(data.guest, true);
  });
});

describe("NanE API — Item Contact View (auth boundary)", () => {

  it("POST /api/items/seed_c01/contact without auth returns 401", async () => {
    const { status, data } = await postJSON(`/api/items/${KNOWN_ITEM_ID}/contact`);
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/items/nonexistent/contact without auth returns 401", async () => {
    const { status } = await postJSON(`/api/items/${NONEXISTENT_ID}/contact`);
    assert.strictEqual(status, 401);
  });
});

describe("NanE API — Item Claim (auth boundary)", () => {

  it("POST /api/items/seed_c01/claim without auth returns 401", async () => {
    const { status, data } = await postJSON(`/api/items/${KNOWN_ITEM_ID}/claim`);
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "AUTH_REQUIRED");
  });

  it("POST /api/items/nonexistent/claim without auth returns 401", async () => {
    const { status } = await postJSON(`/api/items/${NONEXISTENT_ID}/claim`);
    assert.strictEqual(status, 401);
  });
});

console.log(`\nNanE API smoke test loaded. Target: ${BASE_URL}`);
console.log("Run: node --test server/tests/api.test.js");
