# NanE API Reference

Base URL: `/api`

All endpoints return JSON. Authentication uses `Authorization: Bearer <token>` header.

Common error shapes:
```json
{ "error": "ERROR_CODE", "message": "Human-readable message" }
```
Status codes: 200 (ok), 201 (created), 400 (validation), 401 (auth required),
403 (forbidden), 404 (not found), 409 (conflict), 410 (deprecated), 429 (rate limit),
500 (server error), 502 (upstream error), 503 (unavailable).

---

## Health

### GET /api/health

Public. Returns server status.

Response 200:
```json
{ "ok": true, "name": "NanE API", "version": "0.2.0", "database": "postgresql", "time": "2026-06-28T..." }
```

---

## Locations

### GET /api/locations

Public. Returns campus/building/room hierarchy.

Response 200:
```json
{
  "locations": [
    {
      "name": "仙林校区",
      "buildings": [
        { "name": "南苑 A 栋", "rooms": ["101", "102", ...] },
        ...
      ]
    },
    ...
  ]
}
```

---

## Legal

### GET /api/legal/agreement

Public. Returns the user agreement in Markdown.

Response 200:
```json
{ "version": "v1.0", "markdown": "# NanE 用户协议\n..." }
```

### GET /api/legal/privacy

Public. Returns the privacy guideline in Markdown.

Response 200:
```json
{ "markdown": "# 隐私保护指引\n..." }
```

---

## Auth — Email

### POST /api/auth/email/challenge

Sends a 6-digit verification code to the NJU student email.

Request:
```json
{ "email": "student@smail.nju.edu.cn" }
```

Response 200:
```json
{ "challengeId": "email_challenge_abc123", "expiresIn": 300, "message": "验证码已发送至..." }
```

Response 400: `{ "error": "VALIDATION_ERROR", "message": "..." }`
Response 429: `{ "error": "EMAIL_RATE_LIMIT", "message": "验证码发送太频繁" }`

### POST /api/auth/email/verify

Verifies the email code and creates/logs in the user.

Request:
```json
{ "email": "student@smail.nju.edu.cn", "code": "123456", "challengeId": "email_challenge_abc123" }
```

Response 200:
```json
{
  "token": "eyJ...",
  "user": { "id": "email_abc...", "name": "热心小蓝鲸", "email": "student@smail.nju.edu.cn", "is_verified": true, "hasPassword": false, ... },
  "loginMode": "email"
}
```

Response 400: `{ "error": "INVALID_CODE", "message": "验证码错误或已过期" }`

---

## Auth — Password

### POST /api/auth/password/set

Sets a password for the current verified user (requires auth token).

Request:
```json
{ "password": "mypassword123" }
```

Response 200: `{ "message": "密码设置成功" }`
Response 401: `{ "error": "AUTH_REQUIRED", "message": "请先登录后再设置密码" }`

### POST /api/auth/password/login

Logs in with email + password.

Request:
```json
{ "email": "student@smail.nju.edu.cn", "password": "mypassword123" }
```

Response 200:
```json
{ "token": "eyJ...", "user": { ... }, "loginMode": "password" }
```

Response 401: `{ "error": "INVALID_LOGIN", "message": "账号或密码错误" }`
Response 429: `{ "error": "LOGIN_RATE_LIMIT", "message": "登录尝试次数过多" }`

Password rules: 8-64 chars, must contain at least 1 letter and 1 digit.

### POST /api/auth/password/reset-challenge

Sends a password-reset verification code to the email.

Request:
```json
{ "email": "student@smail.nju.edu.cn" }
```

Response 200:
```json
{ "challengeId": "email_challenge_...", "expiresIn": 300, "message": "验证码已发送至对应邮箱" }
```

Response 429: `{ "error": "EMAIL_RATE_LIMIT", "message": "验证码发送太频繁" }`

### POST /api/auth/password/reset

Resets password using the email verification code.

Request:
```json
{ "email": "student@smail.nju.edu.cn", "code": "123456", "password": "newpassword123", "challengeId": "email_challenge_..." }
```

Response 200: `{ "message": "密码重置成功，请使用新密码登录" }`
Response 400: `{ "error": "INVALID_CODE", "message": "验证码错误或已过期" }`

### POST /api/auth/password/change

Changes password for the current user (requires auth token).

Request:
```json
{ "currentPassword": "oldpass123", "newPassword": "newpass123", "confirmPassword": "newpass123" }
```

Response 200: `{ "message": "密码修改成功" }`
Response 400: `{ "error": "WRONG_PASSWORD", "message": "当前密码错误" }`

---

## Auth — Nanna (南哪小帮手)

### POST /api/auth/nanna/challenge

Sends a verification code via the Nanna OAuth service.

Request:
```json
{ "email": "user@smail.nju.edu.cn", "studentId": "221500000" }
```

Response 200:
```json
{ "challengeId": "...", "maskedTarget": "22****00", "expiresIn": 300, "message": "验证码已通过南哪小帮手发送" }
```

Response 503: `{ "error": "NANNA_NOT_CONFIGURED", "message": "..." }`

### POST /api/auth/nanna/verify

Verifies the Nanna challenge code and logs in.

Request:
```json
{ "email": "user@smail.nju.edu.cn", "studentId": "221500000", "code": "123456", "challengeId": "..." }
```

Response 200:
```json
{ "token": "eyJ...", "user": { ... }, "loginMode": "nanna" }
```

---

## Auth — WeChat (Demo)

### POST /api/auth/wx-login

Demo endpoint — always succeeds.

Request:
```json
{ "code": "..." }
```

Response 200:
```json
{ "token": "eyJ...", "user": { ... }, "loginMode": "wx-code-demo" }
```

---

## Items

### GET /api/items

List items with proximity-based sorting. Public, but viewer context improves proximity ranking.

Query parameters:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `keyword` | string | — | Search in title/description/category/type (ILIKE) |
| `itemType` | string | — | Filter: `consumable`, `medicine`, `tool` |
| `category` | string | — | Filter by category (e.g. `感冒药`) |
| `status` | string | `online` | Filter by status (`online`, `all`, etc.) |
| `limit` | int | `50` | Max results (1-100) |
| `offset` | int | `0` | Pagination offset |

Response 200:
```json
{
  "items": [
    {
      "id": "item_abc123",
      "title": "碘伏棉签 10 支",
      "itemType": "consumable",
      "itemIcon": "bandage",
      "category": "应急耗材",
      "description": "...",
      "quantity": 10,
      "unit": "支",
      "campus": "仙林校区",
      "building": "南苑 A 栋",
      "expireDate": "2026-12-31",
      "noExpiry": false,
      "status": "online",
      "imageUrls": ["/uploads/..."],
      "createdAt": "2026-...",
      "ownerId": "u_...",
      "ownerName": "热心小蓝鲸",
      "distanceLabel": "同楼栋",
      "ownerTrustSummary": { "positiveReviewCount": 3, "completedCount": 5, "givenCount": 3, "receivedCount": 2, "topTags": ["沟通顺畅"] }
    }
  ],
  "total": 42,
  "offset": 0,
  "limit": 50,
  "hasMore": false,
  "viewer": { "campus": "仙林校区", "building": "南苑 A 栋" }
}
```

### POST /api/items

Create a new item (requires verified user with complete profile).

Request:
```json
{
  "title": "碘伏棉签 10 支",
  "itemType": "consumable",
  "itemIcon": "bandage",
  "category": "应急耗材",
  "quantity": 10,
  "unit": "支",
  "campus": "仙林校区",
  "building": "南苑 A 栋",
  "room": "",
  "expireDate": "2026-12-31",
  "noExpiry": false,
  "description": "未拆封",
  "imageUrls": ["/uploads/items/..."],
  "contactWechat": "mywechat",
  "contactQq": "",
  "disclaimerAccepted": true
}
```

Response 201:
```json
{ "item": { ... }, "message": "已提交审核，审核通过后会进入首页列表" }
```

Item types and their allowed categories:
| Type | Categories |
|------|------------|
| `consumable` | `应急耗材`, `退烧降温`, `消毒护理`, `外伤处理`, `防护用品`, `其他耗材` |
| `medicine` | `感冒药`, `退烧药`, `过敏药`, `肠胃药`, `其他非处方药` |
| `tool` | `常用工具`, `维修工具`, `手工工具`, `清洁工具`, `其他工具` |

Allowed icon keys: `bandage`, `notesMedical`, `kitMedical`, `capsules`, `pills`, `tablets`, `prescriptionBottleMedical`, `temperatureHalf`, `maskFace`, `shieldVirus`, `pumpMedical`, `bottleDroplet`, `box`, `boxOpen`, `droplet`, `handHoldingMedical`, `heartPulse`, `syringe`, `soap`, `plus`.

Validation rules:
- `quantity` must be a positive integer
- `expireDate` must be `YYYY-MM-DD` and >= tomorrow
- `medicine` type cannot set `noExpiry: true`
- At least one of `contactWechat` / `contactQq` required
- `disclaimerAccepted` must be `true`

### GET /api/items/:id

Get item detail by ID. Public.

Response 200:
```json
{ "item": { ..., "ownerTrustSummary": { ... } } }
```
Note: Contact info is NOT included in public detail. Use `/contact` endpoint.

Response 404: `{ "error": "ITEM_NOT_FOUND", "message": "物品不存在" }`

### POST /api/items/:id/contact

View contact info for an item (requires verified user, max 5/day).

Response 200:
```json
{
  "contact": { "wechat": "mywechat", "qq": "" },
  "alreadyViewed": false,
  "countedThisTime": true
}
```

If already viewed today: `alreadyViewed: true, countedThisTime: false`.

Response 409: `{ "error": "ITEM_NOT_ONLINE", "message": "...联系方式" }`

---

## Claims

### POST /api/items/:id/claim

Claim/request an item (requires verified user).

Request:
```json
{ "quantity": 1 }
```

Response 201:
```json
{
  "claimRequest": { "id": "claim_...", "itemId": "...", "quantity": 1, "status": "pending", ... },
  "emailSent": true,
  "message": "已通过邮件提醒发布者确认领取"
}
```

Response 200 (if already requested):
```json
{ "claimRequest": { ... }, "message": "你已提醒过发布者确认领取" }
```

Response 400: `{ "error": "OWNER_CANNOT_CLAIM", "message": "不能领取自己发布的物品" }`
Response 409: `{ "error": "ITEM_NOT_ONLINE", "message": "该物品当前不可领取" }`

### POST /api/claims/:id/confirm

Owner confirms a claim request (requires verified user, must be item owner).

Response 200:
```json
{
  "claimRequest": { ... },
  "item": { ... },
  "message": "已确认领取，剩余 5 支"
}
```

### POST /api/claims/:id/reject

Owner rejects/ignores a claim request.

Response 200:
```json
{ "claimRequest": { ... }, "message": "已忽略该领取提醒" }
```

### POST /api/claims/:id/reviews

Submit a fulfillment review after a claim is confirmed.

Request:
```json
{
  "tags": ["沟通顺畅", "按约交接"],
  "outcome": "positive",
  "comment": "同学很靠谱"
}
```

Response 201:
```json
{
  "review": { "id": "fr_...", "claimId": "...", "outcome": "positive", "tags": [...], "comment": "...", ... },
  "revieweeTrustSummary": { "positiveReviewCount": 1, ... },
  "message": "履约评价已记录"
}
```

Positive tags: `沟通顺畅`, `按约交接`, `物品真实`, `及时确认`, `友善可信`
Issue tags: `物品不符`, `未按约时间`, `联系方式无效`, `沟通不顺`, `未完成交接`

---

## Me

### GET /api/me

Get current user profile (reads auth token). Returns `user: null` for unauthenticated requests.

Response 200 (authenticated):
```json
{
  "user": {
    "id": "u_...",
    "name": "热心小蓝鲸",
    "campus": "仙林校区",
    "building": "南苑 A 栋",
    "room": "101",
    "email": "student@smail.nju.edu.cn",
    "is_verified": true,
    "profileComplete": true,
    "hasPassword": true,
    "hasAgreement": true,
    "trustSummary": { "positiveReviewCount": 3, "completedCount": 5, "givenCount": 3, "receivedCount": 2, "topTags": ["沟通顺畅"] }
  },
  "agreementVersion": "v1.0"
}
```

Response 200 (guest):
```json
{ "user": null, "guest": true, "agreementVersion": "v1.0", "message": "..." }
```

### POST /api/me/profile

Update profile (requires verified user).

Request:
```json
{ "name": "热心小蓝鲸", "campus": "仙林校区", "building": "南苑 A 栋", "room": "101" }
```

Response 200:
```json
{ "user": { ... }, "message": "账号资料已更新" }
```

Name must be 2-16 characters. Campus/building/room must be valid locations.

### GET /api/me/notifications

Get notification preferences.

Response 200:
```json
{ "claimEmailEnabled": true }
```

### PUT /api/me/notifications

Update notification preferences.

Request:
```json
{ "claimEmailEnabled": false }
```

Response 200:
```json
{ "claimEmailEnabled": false }
```

### GET /api/me/expired-count

Get count of expired items.

Response 200:
```json
{ "count": 3 }
```

### GET /api/me/reviews/pending

List pending fulfillment reviews.

Response 200:
```json
{
  "reviews": [
    {
      "claimId": "claim_...",
      "itemTitle": "碘伏棉签",
      "quantity": 1,
      "unit": "件",
      "reviewerRole": "owner",
      "revieweeName": "同学",
      "itemId": "item_..."
    }
  ],
  "tags": ["沟通顺畅", "按约交接", "物品真实", "及时确认", "友善可信"],
  "issueTags": ["物品不符", "未按约时间", "联系方式无效", "沟通不顺", "未完成交接"]
}
```

### GET /api/me/items

List current user's items with pending claims attached.

Response 200:
```json
{
  "items": [
    {
      "id": "item_...",
      "title": "...",
      "itemType": "consumable",
      "status": "reviewing",
      "pendingClaimCount": 1,
      "claimRequests": [
        { "id": "claim_...", "requesterName": "同学", "quantity": 1, "status": "pending" }
      ],
      "room": "101",
      "contact": { "wechat": "...", "qq": "..." },
      ...
    }
  ]
}
```

### GET /api/me/items/:id

Get detail of user's own item (includes contact info and pending claims).

Response 200:
```json
{ "item": { ..., "contact": { "wechat": "...", "qq": "..." }, "claimRequests": [...] } }
```

### PUT /api/me/items/:id

Update user's own item. Triggers re-review if item was online.

Request:
```json
{
  "title": "Updated title",
  "quantity": 5,
  "unit": "件",
  "description": "Updated description",
  "expireDate": "2027-01-01",
  "noExpiry": false,
  "imageUrls": ["/uploads/items/..."],
  "contactWechat": "wechat",
  "contactQq": ""
}
```

Response 200:
```json
{ "item": { ... }, "message": "物品已更新并重新提交审核" }
```

### POST /api/me/items/:id/take-down

Take down an item that is `online` or `reviewing`.

Response 200:
```json
{ "item": { ... }, "message": "物品已下架" }
```

### POST /api/me/items/:id/delete

Delete an item record (soft-delete via `owner_hidden`). Online/reviewing items are taken down first.

Response 200:
```json
{ "message": "发布记录已删除。" }
```

---

## Uploads

### POST /api/uploads/images

Upload an image (requires verified user). File is sent as base64 data URL.

Request:
```json
{ "dataUrl": "data:image/webp;base64,AAAA...", "filename": "photo.webp" }
```

Response 201:
```json
{ "url": "/uploads/items/u_.../2026/06/img_abc123.webp", "contentType": "image/webp", "size": 12345 }
```

Limits: max 3MB per image, PNG/JPG/WebP only.

---

## Admin

### POST /api/admin/login

Login as admin.

Request:
```json
{ "username": "admin", "password": "..." }
```

Response 200:
```json
{ "token": "eyJ..." }
```

### GET /api/admin/items

List all items for admin review (requires admin auth).

Query: `?status=reviewing` (default), `?status=all` for all.

Response 200:
```json
{ "items": [ { ... contact included ... } ] }
```

### GET /api/admin/stats

Get moderation statistics.

Response 200:
```json
{
  "reviewing": 5,
  "online": 42,
  "offline": 10,
  "contact_views_today": 18,
  "confirmed_claims": 22,
  "fulfillment_reviews": 15,
  "total_users": 100,
  "banned_users": 2,
  "new_users_today": 3
}
```

### POST /api/admin/items/:id/approve

Approve an item (requires moderator+ role).

Request: `{}`

Response 200: `{ "item": { ... } }`

### POST /api/admin/items/:id/reject

Reject an item.

Request:
```json
{ "reason": "缺少必要信息" }
```

Response 200: `{ "item": { ... } }`

### POST /api/admin/items/:id/take-down

Take down an item.

Request: `{}`

### POST /api/admin/items/batch

Batch review items (requires moderator+ role).

Request:
```json
{ "ids": ["item_1", "item_2"], "action": "approve", "reason": "" }
```

Allowed actions: `approve`, `reject`, `take-down`.

Response 200:
```json
{ "reviewed": 2, "total": 2, "message": "已处理 2/2 个物品" }
```

### GET /api/admin/admins

List all admins (requires super_admin).

### POST /api/admin/admins

Create admin (requires super_admin).

Request:
```json
{ "username": "mod1", "password": "...", "role": "moderator" }
```

Roles: `super_admin`, `moderator`, `viewer`.

### DELETE /api/admin/admins/:id

Delete an admin. Cannot delete self or the last super_admin.

### GET /api/admin/users

List users (requires moderator+ role).

Query params: `keyword`, `is_verified`, `is_banned`, `page`, `page_size`.

Response 200:
```json
{
  "users": [ { "id": "u_...", "name": "...", "email": "...", "is_verified": true, ... } ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

### POST /api/admin/users/:id/ban

Ban or unban a user.

Request:
```json
{ "ban": true, "reason": "违规发布" }
```

Response 200:
```json
{ "user": { "id": "...", "name": "...", "is_banned": true, "ban_reason": "违规发布" } }
```

---

## Deprecated

### POST /api/auth/email-login

Returns 410 Gone. Use `POST /api/auth/email/challenge` + `POST /api/auth/email/verify` instead.
