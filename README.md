# NanE 南易

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![JavaScript](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![PWA](https://img.shields.io/badge/PWA-Service%20Worker-5A0FC8)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Tests](https://img.shields.io/badge/tests-242%20passing-25735A)](#testing)

NanE（南易）是面向南京大学校园场景的免费互助平台。它帮助同学把宿舍里临时闲置、仍可安全使用的应急耗材、非处方常见药品笼统分类物品和常用工具，分享给附近真正需要的人。

平台的核心不是二手交易，而是**同楼栋、同宿舍群、同校区优先的校园互助撮合**。NanE 不做买卖、不做配送、不提供医疗建议；它只负责把可信、审核过的信息展示给合适范围内的同学，并把一次互助沉淀为可追踪的履约记录。

## Live Entrypoints

> **Current status:** Deployment temporarily offline. The service was previously live at the URLs below and can be restored by restarting the Azure VM (PM2 + Nginx). See [server/](server/) for deployment scripts.

| Surface | URL | Status |
| --- | --- | --- |
| Web app | [https://nane.zylatent.com](https://nane.zylatent.com) | 🔴 Offline |
| Admin console | [https://nane.zylatent.com/admin](https://nane.zylatent.com/admin) | 🔴 Offline |
| API health | [https://api.zylatent.com/api/health](https://api.zylatent.com/api/health) | 🔴 Offline |
| API reference | [docs/api/index.md](docs/api/index.md) | ✅ Always available |

## Why It Exists

宿舍生活里经常出现一个小但真实的矛盾：有人只用了一点创可贴、碘伏棉签、退烧贴、过敏药或螺丝刀，剩下的东西长期闲置；另一个同学却可能在深夜、雨天、考试周或突发场景里临时急需。

现有渠道各有问题：

- 宿舍群和朋友圈响应快，但信息很快沉底，无法沉淀为可检索资源。
- 二手平台更适合交易，不适合低价甚至免费的应急互助，还会引入交易和陌生人信任成本。
- 校园论坛、表白墙等渠道信息非结构化，很难按楼栋、校区、类型和有效期快速筛选。

NanE 的解决方式是把校园互助拆成可审核、可筛选、可确认、可评价的轻量闭环。

## Product Boundaries

NanE 有三条硬边界：

1. **只做免费互助**：禁止收费转让、变相交易和商业引流。
2. **所有发布先审核**：物品通过人工审核后才会公开展示。
3. **药品严格收口**：只允许常见非处方药的笼统分类，不展示处方药、管制药品或具体用药建议。

平台不会替用户判断物品是否适合使用。领取者在联系和领取前，需要自行检查包装、有效期、保存状态和适用风险。

## Current Features

| Area | Status | What It Does |
| --- | --- | --- |
| 首页发现 | Done | 搜索、类型筛选、分类筛选、按楼栋切换浏览 |
| 近邻排序 | Done | 同楼栋 > 同宿舍群 > 同校区 > 其他校区 |
| 楼栋动态 | Done | 展示指定楼栋最近分享和已确认领取 |
| 物品发布 | Done | 支持耗材、药品、工具，含图片、数量、有效期、位置和联系方式 |
| 人工审核 | Done | 管理员可通过、驳回、下架、批量处理 |
| 联系方式保护 | Done | 游客不可见联系方式，登录并补全资料后主动查看 |
| 领取提醒 | Done | 领取者提醒发布者确认领取 |
| 履约评价 | Done | 发布者和领取者各评价一次，公开展示正向可信摘要 |
| 我的页面 | Done | 我的发布、领取记录、待评价记录、账号设置 |
| 账号系统 | Done | NJU 邮箱验证码、密码登录、重置密码、南哪认证代理 |
| 图片上传 | Done | 支持本地/MinIO 存储、类型校验、孤儿图片清理 |
| 管理后台 | Done | 审核、举报、用户、管理员、楼栋动态、统计 |
| PWA/通知 | Partial | Service Worker、manifest、Web Push 配置入口 |
| 小程序端 | Retained | 微信小程序代码保留，当前主交付为 Web |

## Core User Flow

```text
游客浏览
  -> NJU 邮箱登录 / 南哪认证
  -> 补全昵称、校区、楼栋
  -> 发布物品
  -> 管理员审核
  -> 首页公开展示
  -> 领取者查看联系方式
  -> 线下联系与交接
  -> 领取者提醒已领取
  -> 发布者确认
  -> 双方履约评价
  -> 可信记录沉淀
```

## Architecture

NanE 是一个单进程 Node.js 服务，负责静态文件、业务 API、管理后台和数据库初始化。前端没有构建步骤，Web 端使用原生 HTML/CSS/JavaScript；后端使用 Node 内置 `http` 模块和 PostgreSQL。

```text
Browser / Mini Program
  -> Nginx HTTPS
  -> Node.js service :37878
      ├─ /                 web app
      ├─ /web/*            web static files
      ├─ /admin            admin console
      ├─ /admin/*          admin static files
      ├─ /api/*            JSON API
      ├─ /uploads/*        local uploaded images
      └─ /assets/*         mini-program assets
  -> PostgreSQL
```

### Backend Layout

```text
server/
├── index.js              # HTTP server, static serving, router dispatch
├── db.js                 # PostgreSQL pool, schema init, migrations, seed data
├── proximity.js          # campus/building proximity ranking
├── lib/
│   ├── item-utils.js     # item shape, trust summary, icon normalization
│   ├── jwt.js            # signed JWT helpers
│   ├── logger.js         # structured logging
│   └── util.js           # JSON, body parsing, escaping, helpers
├── middleware/
│   ├── auth.js           # verified user and admin guards
│   └── rate-limit.js     # lightweight login rate limiting
├── router/
│   ├── auth.js           # /api/auth/*
│   ├── items.js          # /api/items/* and /api/activity
│   ├── claims.js         # /api/claims/*
│   ├── me.js             # /api/me/*
│   ├── admin.js          # /api/admin/* and /admin
│   ├── uploads.js        # /api/uploads/images
│   └── info.js           # health, locations, legal docs
└── service/
    ├── email.js          # SMTP verification and notifications
    ├── image-upload.js   # local/MinIO image storage
    ├── nanna.js          # 南哪 API proxy
    └── push.js           # Web Push
```

### Frontend Layout

```text
web/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── fa-subset.css
└── js/
    ├── app.js            # app bootstrap and global state
    ├── api/client.js
    ├── ui/               # dialog, motion, skeleton, toast
    ├── utils/            # date, escape, validate
    └── views/            # home, publish, mine, settings
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web client | Vanilla HTML/CSS/JavaScript |
| Admin console | Vanilla HTML/CSS/JavaScript |
| Mini Program | WeChat Mini Program code retained in `miniprogram/` |
| Backend | Node.js native `http` |
| Database | PostgreSQL via `pg` |
| Auth | NJU email verification, password login, Nanna proxy, signed JWT |
| Mail | SMTP |
| Images | Local uploads or MinIO-compatible object storage |
| Push | Web Push / VAPID |
| Deployment | Azure VM, Ubuntu, Nginx, PM2, Let's Encrypt |

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL
- npm

### Install

```bash
npm install
```

### Configure Environment

Copy the example file and fill in local values:

```bash
cp .env.example .env
```

Important variables:

```text
PORT=37878
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nane
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSWORD=replace-with-a-strong-admin-password
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your-qq-email@qq.com
SMTP_PASS=replace-with-smtp-authorization-code
PUBLIC_WEB_URL=https://nane.zylatent.com
```

Optional integrations include `NANNA_API_KEY`, MinIO settings and VAPID keys. Never commit real `.env` values.

### Run Locally

```bash
npm start
```

Open:

```text
http://localhost:37878
http://localhost:37878/admin
http://localhost:37878/api/health
```

On startup, the server initializes the database schema, applies compatibility migrations and inserts seed data when needed.

## Testing

```bash
npm test
```

`npm test` starts an isolated test API server and runs the Node test suite. Current suite coverage includes:

- public health, legal and locations endpoints
- guest browsing
- auth validation
- protected route boundaries
- item list/detail flows
- admin stats/items/activity APIs
- trust summary and fulfillment review helpers
- proximity ranking
- utility functions

Run tests against an already running server:

```bash
npm run test:direct
```

Use `NANE_TEST_BASE_URL` to point direct tests at another server.

## Deployment

Production currently runs on an Azure VM behind Nginx and PM2.

```bash
cd ~/apps/NanE
git pull --ff-only
npm install
pm2 restart nane-api --update-env
```

Health check:

```bash
curl https://api.zylatent.com/api/health
pm2 status
pm2 logs nane-api --lines 80
```

Full notes are in [docs/deployment-guide.md](docs/deployment-guide.md).

## Demo Script

A short demo path for product review:

1. Open the home page and show nearby items.
2. Use search, category filters and "换个楼栋" to show cross-campus building browsing.
3. Open an item detail and show that contact info is hidden for guests.
4. Log in with a verified user and complete profile.
5. Publish an item and show it enters review.
6. Log into the admin console and approve it.
7. Return to the home page, view contact info, and send a claim reminder.
8. Confirm the claim from the publisher side.
9. Submit fulfillment review tags.
10. Show the trust summary and admin building activity panel.

More detailed scripts:

- [docs/demo-script.md](docs/demo-script.md)
- [docs/full-chain-demo-script.md](docs/full-chain-demo-script.md)

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/api/index.md](docs/api/index.md) | API reference |
| [docs/deployment-guide.md](docs/deployment-guide.md) | production deployment and operations |
| [docs/test-guide.md](docs/test-guide.md) | manual acceptance test guide |
| [docs/ROADMAP.md](docs/ROADMAP.md) | staged engineering roadmap |
| [docs/iteration-fulfillment-review.md](docs/iteration-fulfillment-review.md) | fulfillment review MVP notes |
| [docs/iteration-admin-convergence.md](docs/iteration-admin-convergence.md) | admin convergence notes |
| [docs/user-agreement.md](docs/user-agreement.md) | user agreement |
| [docs/privacy-guideline-draft.md](docs/privacy-guideline-draft.md) | privacy guideline draft |
| [CHANGELOG.md](CHANGELOG.md) | historical changes |

## Security and Privacy Notes

- Public item lists never expose WeChat, QQ or room number.
- Contact info is returned only through the dedicated contact endpoint.
- Admin views include sensitive details and require admin JWT.
- Location matching uses campus/building data instead of GPS.
- Item posts require manual review before becoming public.
- The project currently keeps CORS permissive for mini-program compatibility; tighten this before broader production rollout.
- `.env`, SMTP credentials, JWT secrets, MinIO keys and Nanna keys must stay out of Git.

## Project Status

NanE is a deployable competition MVP with several post-MVP refinements already included:

- backend router/module split
- responsive Web UI and dark mode
- service worker cache
- image upload and cleanup
- fulfillment review and trust summary
- admin reports, users, roles and building activity
- API smoke/regression tests

Next likely directions:

- migrate remaining compatibility DDL into explicit migration files
- expand item/service taxonomy with stricter review rules
- add admin audit search for reviews and abnormal users
- improve CORS/security headers and request body limits
- bring mini-program release flow back after deployment constraints are cleared

## License

No open-source license is currently declared in this repository. Treat the code and project materials as private unless a license is added.

## Acknowledgements

NanE is built around a simple campus idea: nearby students can help each other faster than a marketplace can. The project uses Node.js, PostgreSQL, Font Awesome Free, Web Push and the Nanjing University campus context to turn that idea into a working product loop.
