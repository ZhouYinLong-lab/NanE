# NanE 南易校园互助平台

NanE（南易）是面向南京大学校园场景的免费互助信息平台，将宿舍内临时闲置的低风险应急耗材和非处方常见药品，以"同楼栋、同宿舍群、同校区优先"的方式撮合给需要的同学。

平台坚持三个边界：

- 只做校园互助信息撮合，不做买卖平台。
- 所有发布内容免费共享，禁止收费转让。
- 药品类只允许非处方常见笼统分类，禁止处方药、管控药、拆封不明药品和医疗建议。

## 当前状态

已上线运行：[nane.zylatent.com](https://nane.zylatent.com)

- **网页端** — 浏览、搜索、发布互助物品，游客可浏览但需登录后才能查看联系方式
- **管理后台** — `/admin`，审核、驳回、下架物品，查看统计
- **API** — `api.zylatent.com/api`，为网页端和小程序端提供统一后端
- **小程序** — 代码保留在 `miniprogram/`，备案完成后恢复上线

权限模型：游客可浏览 → 认证用户可发布/查看联系方式（每日限 5 次）→ 管理员可审核管理。

## 快速开始

需要 Node.js >= 18 和 PostgreSQL（数据库名 `nane`）。

```bash
cp .env.example .env    # 编辑 .env 填入数据库连接等配置
npm install
npm start               # 启动于 http://localhost:37878
```

首次启动自动初始化数据库表并插入种子数据。默认管理员：`admin` / 密码见 `ADMIN_PASSWORD` 环境变量。

## 技术栈

| 模块 | 技术 |
|------|------|
| 网页端 | 原生 HTML / CSS / JavaScript，无框架无构建 |
| 后端 | Node.js 原生 `http` 模块，单文件 ~2000 行 |
| 数据库 | PostgreSQL，通过 `pg` 访问 |
| 认证 | 南大邮箱验证码 + 南哪小帮手 OAuth，自签 JWT |
| 部署 | Azure VM (Ubuntu) + Nginx + PM2 + Let's Encrypt |
| 图标 | Font Awesome Free 本地字体 |

## 目录结构

```
NanE
├─ web/                  # 网页端 (index.html, app.js, styles.css)
├─ server/               # 后端 API + 管理后台 + 数据库初始化
│  ├─ index.js           #   主入口，路由处理 + 内嵌 /admin 页面
│  ├─ db.js              #   数据库连接、初始化、迁移、种子数据
│  ├─ proximity.js       #   同楼栋/宿舍群/校区排序算法
│  ├─ env.js             #   .env 加载
│  └─ schema.sql         #   基础 DDL
├─ miniprogram/          # 微信小程序（代码保留，备案后恢复）
├─ docs/                 # 测试指南、部署指南、演示脚本、用户协议等
├─ assets/brand/         # Logo 等品牌素材
├─ CHANGELOG.md
└─ package.json
```

## 架构

```
浏览器 / 小程序 → Nginx HTTPS → Node (端口 37878) → PostgreSQL
                                   ├─ /           静态网页
                                   ├─ /api/*      API
                                   ├─ /admin      管理后台
                                   └─ /assets/*   小程序静态资源
```

所有端共享同一个 Node 进程和 PostgreSQL 数据库。没有 service 层或中间件抽象，业务逻辑内联在路由处理函数中。

## 核心设计

**物品类型**：耗材（默认归类为"应急耗材"）和药品（仅限感冒药、退烧药、过敏药等笼统分类）。

**排序**：不依赖 GPS，按同楼栋 > 同宿舍群 > 同校区 > 其他校区排列（算法见 `server/proximity.js`）。

**联系方式保护**：默认隐藏，登录后点击查看才调用专用接口，每人每日限 5 次。宿舍号仅发布者和管理员可见。

**审核流**：发布 → `reviewing` → 管理员审核 → `online` / `rejected`。领取确认后数量扣减，归零自动变为 `claimed`。

**认证**：南京大学学生邮箱（`@smail.nju.edu.cn`）验证码登录为主，南哪小帮手 OAuth 为备用。NanE 后端签发自己的 JWT，第三方 API Key 不进入前端或仓库。

## 部署

生产环境部署指南详见 [`docs/deployment-guide.md`](docs/deployment-guide.md)。

简要更新流程：

```bash
cd ~/apps/NanE && git pull && pm2 restart nane-api --update-env
```

## 配套文档

- [`CHANGELOG.md`](CHANGELOG.md) — 版本变更记录
- [`CLAUDE.md`](CLAUDE.md) — AI 助手的代码库指南（架构、约定、模式）
- [`docs/deployment-guide.md`](docs/deployment-guide.md) — 部署与运维
- [`docs/test-guide.md`](docs/test-guide.md) — 验收测试
- [`docs/demo-script.md`](docs/demo-script.md) — 演示脚本（含视频录制版）
- [`docs/user-agreement.md`](docs/user-agreement.md) — 用户协议
- [`docs/privacy-guideline-draft.md`](docs/privacy-guideline-draft.md) — 隐私保护指引

## 仓库

[ZhouYinLong-lab/NanE](https://github.com/ZhouYinLong-lab/NanE)
