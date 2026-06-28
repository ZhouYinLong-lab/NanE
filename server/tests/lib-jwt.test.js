const { describe, it } = require("node:test");
const assert = require("node:assert");

// Set JWT_SECRET before requiring
process.env.JWT_SECRET = "test-secret-12345";

const { signToken, verifyToken, publicUser, userHasAgreement, userProfileComplete, agreementAccepted } = require("../lib/jwt");

describe("signToken / verifyToken", () => {
  it("should round-trip a payload", () => {
    const token = signToken({ sub: "u_test", role: "user" });
    const payload = verifyToken(token);
    assert.ok(payload);
    assert.strictEqual(payload.sub, "u_test");
    assert.strictEqual(payload.role, "user");
  });

  it("should include iat and exp claims", () => {
    const token = signToken({ sub: "u_test" });
    const payload = verifyToken(token);
    assert.ok(payload.iat);
    assert.ok(payload.exp);
    assert.ok(payload.exp > payload.iat);
  });

  it("should default exp to ~30 days from iat", () => {
    const payload = verifyToken(signToken({ sub: "u_test" }));
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const diff = payload.exp - payload.iat;
    assert.strictEqual(diff, thirtyDaysInSeconds);
  });

  it("should return null for invalid token", () => {
    assert.strictEqual(verifyToken("nonsense"), null);
    assert.strictEqual(verifyToken("a.b.c"), null);
    assert.strictEqual(verifyToken(""), null);
    assert.strictEqual(verifyToken(null), null);
  });

  it("should return null for tampered token", () => {
    const token = signToken({ sub: "u_test" });
    const tampered = token.slice(0, -5) + "xxxxx";
    assert.strictEqual(verifyToken(tampered), null);
  });

  it("should return null for malformed body (non-JSON)", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from("not-json").toString("base64url");
    const signature = require("crypto").createHmac("sha256", process.env.JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    assert.strictEqual(verifyToken(`${header}.${body}.${signature}`), null);
  });

  it("should use HS256 algorithm", () => {
    const token = signToken({ sub: "u_test" });
    const parts = token.split(".");
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    assert.strictEqual(header.alg, "HS256");
    assert.strictEqual(header.typ, "JWT");
  });
});

describe("publicUser", () => {
  it("should strip password fields", () => {
    const user = {
      id: "u_1", name: "测试", campus: "仙林", building: "1栋",
      password_hash: "secret123", password_salt: "salt456",
      is_verified: true
    };
    const pub = publicUser(user);
    assert.strictEqual(pub.password_hash, undefined);
    assert.strictEqual(pub.password_salt, undefined);
    assert.strictEqual(pub.id, "u_1");
    assert.strictEqual(pub.name, "测试");
  });

  it("should return null for null/undefined user", () => {
    assert.strictEqual(publicUser(null), null);
    assert.strictEqual(publicUser(undefined), null);
  });

  it("should add hasAgreement, profileComplete, trustSummary fields", () => {
    const user = {
      id: "u_1", name: "测试", campus: "仙林", building: "1栋",
      agreement_accepted_at: new Date().toISOString(),
      agreement_version: "v1.0",
      is_verified: true
    };
    const pub = publicUser(user);
    assert.strictEqual(pub.hasAgreement, true);
    assert.strictEqual(pub.profileComplete, true);
    assert.ok(pub.trustSummary);
    assert.strictEqual(pub.trustSummary.completedCount, 0);
  });

  it("should accept custom trustSummary via options", () => {
    const customSummary = { completedCount: 5, givenCount: 2, receivedCount: 3, positiveReviewCount: 4, topTags: ["沟通顺畅"] };
    const pub = publicUser({ id: "u_1", name: "x" }, { trustSummary: customSummary });
    assert.strictEqual(pub.trustSummary.completedCount, 5);
    assert.strictEqual(pub.trustSummary.topTags[0], "沟通顺畅");
  });

  it("should set hasPassword based on password_hash presence", () => {
    const withPw = publicUser({ id: "u_1", name: "x", password_hash: "hash" });
    assert.strictEqual(withPw.hasPassword, true);

    const withoutPw = publicUser({ id: "u_1", name: "x" });
    assert.strictEqual(withoutPw.hasPassword, false);
  });

  it("should preserve all other fields", () => {
    const user = { id: "u_1", name: "测试", campus: "仙林", building: "1栋", is_verified: true, wechat: "wx123", created_at: "2024-01-01" };
    const pub = publicUser(user);
    assert.strictEqual(pub.campus, "仙林");
    assert.strictEqual(pub.building, "1栋");
    assert.strictEqual(pub.is_verified, true);
    assert.strictEqual(pub.wechat, "wx123");
    assert.strictEqual(pub.created_at, "2024-01-01");
  });
});

describe("userHasAgreement", () => {
  it("should return true when agreement_accepted_at and agreement_version match", () => {
    assert.ok(userHasAgreement({ agreement_accepted_at: "2024-01-01", agreement_version: "v1.0" }));
  });

  it("should return false when agreement_version does not match", () => {
    assert.strictEqual(userHasAgreement({ agreement_accepted_at: "2024-01-01", agreement_version: "v0.9" }), false);
  });

  it("should return false when agreement_accepted_at is missing", () => {
    assert.strictEqual(userHasAgreement({ agreement_version: "v1.0" }), false);
  });

  it("should return false for null/undefined user", () => {
    assert.strictEqual(userHasAgreement(null), false);
    assert.strictEqual(userHasAgreement(undefined), false);
  });

  it("should return false for empty object", () => {
    assert.strictEqual(userHasAgreement({}), false);
  });
});

describe("userProfileComplete", () => {
  it("should return true when name, campus, building are set", () => {
    assert.ok(userProfileComplete({ name: "x", campus: "仙林", building: "1栋" }));
  });

  it("should return false when building is '未设置楼栋'", () => {
    assert.strictEqual(userProfileComplete({ name: "x", campus: "仙林", building: "未设置楼栋" }), false);
  });

  it("should return false when name is missing", () => {
    assert.strictEqual(userProfileComplete({ campus: "仙林", building: "1栋" }), false);
  });

  it("should return false when campus is missing", () => {
    assert.strictEqual(userProfileComplete({ name: "x", building: "1栋" }), false);
  });

  it("should return false when building is missing", () => {
    assert.strictEqual(userProfileComplete({ name: "x", campus: "仙林" }), false);
  });

  it("should return false for empty user", () => {
    assert.strictEqual(userProfileComplete({}), false);
  });

  it("should return false for null/undefined", () => {
    assert.strictEqual(userProfileComplete(null), false);
    assert.strictEqual(userProfileComplete(undefined), false);
  });
});

describe("agreementAccepted", () => {
  it("should return true when agreementAccepted is true and version matches", () => {
    assert.ok(agreementAccepted({ agreementAccepted: true }));
  });

  it("should return false when agreementAccepted is not true", () => {
    assert.strictEqual(agreementAccepted({ agreementAccepted: false }), false);
    assert.strictEqual(agreementAccepted({ agreementAccepted: "yes" }), false);
  });

  it("should return false when agreementVersion does not match", () => {
    assert.strictEqual(agreementAccepted({ agreementAccepted: true, agreementVersion: "v0.9" }), false);
  });

  it("should return false for null/undefined input", () => {
    assert.strictEqual(agreementAccepted(null), false);
    assert.strictEqual(agreementAccepted(undefined), false);
  });

  it("should return false for empty object", () => {
    assert.strictEqual(agreementAccepted({}), false);
  });
});
