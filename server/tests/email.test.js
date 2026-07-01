const { describe, it } = require("node:test");
const assert = require("node:assert");

const { emailHtml, emailHtmlLine } = require("../service/email");

describe("emailHtml", () => {
  it("escapes regular body lines", () => {
    const html = emailHtml("测试邮件", ["<script>alert('x')</script>"], "", "");
    assert.ok(html.includes("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"));
    assert.ok(!html.includes("<script>alert"));
  });

  it("renders explicitly trusted html body lines", () => {
    const html = emailHtml(
      "登录验证码",
      [emailHtmlLine('你的验证码是：<strong style="font-size:24px;letter-spacing:4px;color:#6E0065">917786</strong>')],
      "",
      ""
    );
    assert.ok(html.includes('<strong style="font-size:24px;letter-spacing:4px;color:#6E0065">917786</strong>'));
    assert.ok(!html.includes("&lt;strong"));
  });
});
