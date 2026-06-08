# NanE 南易校园互助平台

NanE（南易）是面向南京大学校园场景的免费互助信息平台，目标是把宿舍和校园内临时闲置的低风险应急耗材、非处方常见药品笼统分类信息，以“同楼栋、同宿舍群、同校区优先”的方式撮合给真正需要的同学。

平台坚持三个边界：

- 只做校园互助信息撮合，不做买卖平台。
- 所有发布内容免费共享，禁止收费转让。
- 药品类只允许非处方常见笼统分类，禁止处方药、管控药、拆封不明药品和医疗建议。

当前工程已经从小程序 Demo 演进为可部署的完整后端 + 网页端 + 管理后台。微信小程序文件仍完整保留，因小程序备案流程较长，现阶段优先通过网页版继续演示和测试。

## 项目目的

大学宿舍里常见“应急物品买多了但用不完”的情况，例如创可贴、碘伏棉签、退烧贴、口罩等。另一方面，同楼栋或附近楼栋的同学可能正好急需这些物品，但通过宿舍群、朋友圈或表白墙求助容易错过，信息也难以沉淀。

NanE 希望解决的是一个很轻但很真实的问题：

- 降低同学临时寻找应急物品的成本。
- 减少宿舍小药箱和耗材囤积造成的浪费。
- 利用校园身份和楼栋信息建立更可信、更近距离的互助网络。
- 用人工审核和合规文案避免平台滑向药品交易或医疗服务。

## 当前状态

已打通：

- 网页端：`https://nane.zylatent.com`
- API：`https://api.zylatent.com/api`
- 管理后台：`https://nane.zylatent.com/admin`
- PostgreSQL 数据库
- Azure VM 部署
- Nginx + HTTPS
- PM2 进程管理
- 南哪小帮手 challenge-code 身份验证接口骨架

当前权限模型：

- 游客：可浏览首页列表和详情公开信息。
- 南哪小帮手认证用户：可发布互助、查看微信 / QQ、查看自己的发布记录。
- 管理员：可审核、驳回、下架、查看统计。

## 产品形态

```text
浏览器网页版
  -> https://nane.zylatent.com
  -> NanE Node 服务
  -> PostgreSQL

微信小程序
  -> https://api.zylatent.com/api
  -> NanE Node 服务
  -> PostgreSQL

管理后台
  -> https://nane.zylatent.com/admin
  -> NanE Node 服务
  -> PostgreSQL

未来 EXE
  -> 封装 Web 客户端
  -> 复用同一套 API 和数据库
```

### 网页端

`web/` 是当前主演示端，由同一个 Node 服务托管，不需要额外前端构建流程。

主要能力：

- 首页浏览审核通过的互助物品。
- 搜索关键词。
- 按耗材 / 非处方药品筛选。
- 物品详情展示公开信息。
- 游客不可查看联系方式。
- 南哪小帮手认证后可查看微信 / QQ。
- 南哪小帮手认证后可发布互助。
- 南哪小帮手认证后可查看“我的发布”。
- 使用本地 PNG logo 作为网页 favicon。

本地访问：

```text
http://localhost:37878/
```

生产访问：

```text
https://nane.zylatent.com
```

### 微信小程序

`miniprogram/` 保留完整微信小程序工程。小程序端已经实现：

- 首页线性列表 UI。
- 米色背景 + 南大纯紫视觉风格。
- 发布表单。
- 校区 / 楼栋 / 宿舍号数据。
- “鼓楼 南二 321”等自然语言位置识别。
- 详情页。
- 我的页。
- 我的发布。
- 南哪小帮手身份验证入口。

当前由于小程序备案较繁琐，短期不以小程序上线为阻塞项；后续备案完成后，小程序可继续复用同一套 API。

### 管理后台

管理后台由同一个 Node 服务内嵌提供：

```text
https://nane.zylatent.com/admin
```

主要能力：

- 管理员登录。
- 查看待审核、上架中、已驳回、已下架物品。
- 通过审核。
- 驳回并填写原因。
- 下架物品。
- 查看待审数、上架数、下架数、今日联系方式查看次数。
- 查看发布者联系方式和宿舍号，辅助审核。

## 功能设计

### 物品发布

发布内容分为两类：

- 耗材：不要求用户选择细分类，后端默认保存为 `应急耗材`。
- 药品：只允许笼统分类，包括 `感冒药`、`退烧药`、`过敏药`、`肠胃药`、`其他非处方药`。

发布必填信息：

- 物品名称
- 物品类型
- 数量
- 单位
- 校区
- 楼栋
- 有效期
- 微信或 QQ 至少一项
- 免费互助和合规声明确认

发布选填信息：

- 宿舍号
- 补充说明
- 图标

发布后默认状态为 `reviewing`，只有管理员审核通过后才会进入首页。

### 推荐排序

首页排序不依赖 GPS，而是使用校区和楼栋信息：

1. 同楼栋
2. 同宿舍群
3. 同校区
4. 其他校区

宿舍群规则位于 `server/proximity.js`，目前覆盖仙林、苏州、浦口的主要宿舍群。

### 联系方式保护

联系方式不会直接公开在首页或详情接口中。

- 游客不能查看微信 / QQ。
- 南哪小帮手认证用户点击查看后才会调用 `/api/items/:id/contact`。
- 每个用户每日最多查看 5 次联系方式。
- 查看记录写入 `contact_views` 表。

### 隐私边界

- 首页和详情只展示到楼栋。
- 宿舍号仅发布者本人和管理员可见。
- 联系方式默认隐藏。
- 管理员查看完整信息仅用于审核和风险处理。

## 技术栈

| 模块 | 技术 |
|------|------|
| 网页端 | 原生 HTML / CSS / JavaScript |
| 小程序端 | 微信小程序 WXML / WXSS / JS |
| 后端 | Node.js 原生 `http` 服务 |
| 数据库 | PostgreSQL |
| 数据库访问 | `pg` |
| 管理后台 | Node 服务内嵌 HTML 页面 |
| 身份验证 | 南哪小帮手 challenge-code + NanE 自签 JWT |
| 图标 | Font Awesome Free 本地字体 + NanE PNG logo |
| 部署 | Azure VM, Ubuntu 24.04 |
| 反向代理 | Nginx |
| HTTPS | Let's Encrypt / Certbot |
| 进程管理 | PM2 |

项目没有引入 React / Vue 构建流程。当前选择偏保守，目标是降低部署复杂度，让 API、网页和后台都能由同一个 Node 进程提供。

## 目录结构

```text
NanE
├─ web/                         # 网页端
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
├─ miniprogram/                 # 微信小程序端
│  ├─ pages/
│  ├─ utils/
│  ├─ data/
│  └─ assets/
├─ server/                      # 后端、管理后台、数据库初始化
│  ├─ index.js
│  ├─ db.js
│  ├─ env.js
│  ├─ proximity.js
│  └─ schema.sql
├─ docs/                        # 上线清单、隐私草稿、演示脚本、开发日志
├─ README.md
├─ PROJECT_CONTEXT.md
├─ package.json
└─ project.config.json
```

## 系统架构

```text
用户浏览器
  -> Nginx HTTPS
  -> Node 静态网页 /
  -> Node API /api/*
  -> PostgreSQL

微信小程序
  -> HTTPS request 合法域名
  -> Node API /api/*
  -> PostgreSQL

管理员浏览器
  -> /admin
  -> 管理 API
  -> PostgreSQL
```

同一套后端负责：

- 静态托管网页端。
- 提供用户 API。
- 提供管理后台。
- 初始化数据库 schema。
- 执行身份验证。
- 执行发布、审核、联系方式限流等业务逻辑。

## 账号系统

### 南哪小帮手登录流程

NanE 不把南哪小帮手 API Key 暴露给前端。登录流程为：

1. 用户在网页或小程序输入邮箱 / 学号。
2. NanE 后端携带 `NANNA_API_KEY` 调用南哪小帮手 `/api/v1/oauth/challenge`。
3. 南哪小帮手向用户发送验证码。
4. 用户在 NanE 输入验证码。
5. NanE 后端调用南哪小帮手 `/api/v1/oauth/verify`。
6. 南哪小帮手返回身份信息。
7. NanE 按 `openid` 创建或更新用户。
8. NanE 签发自己的 JWT。
9. 前端后续请求携带 NanE JWT。

建议 scope：

```text
identity:basic:read
identity:student_id:read
identity:campus:read
identity:major:read
```

### 权限规则

| 操作 | 游客 | 南哪小帮手认证用户 | 管理员 |
|------|------|----------------|--------|
| 浏览首页 | 可以 | 可以 | 可以 |
| 查看公开详情 | 可以 | 可以 | 可以 |
| 查看微信 / QQ | 不可以 | 可以 | 可以 |
| 发布互助 | 不可以 | 可以 | 不适用 |
| 查看我的发布 | 不可以 | 可以 | 不适用 |
| 审核内容 | 不可以 | 不可以 | 可以 |

## 数据模型

核心表：

- `users`：用户、openid、认证状态、校区楼栋、联系方式。
- `items`：互助物品、类型、分类、图标、数量、位置、状态、联系方式。
- `contact_views`：联系方式查看记录和每日限流依据。
- `review_logs`：审核动作记录。
- `admins`：管理员账号。

物品状态：

- `reviewing`：待审核
- `online`：已上架
- `rejected`：已驳回
- `taken_down`：已下架
- `expired`：已过期

## API 概览

### 用户与身份

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/auth/wx-login` | Demo 微信登录兜底 |
| `POST` | `/api/auth/nanna/challenge` | 发起南哪小帮手验证码 |
| `POST` | `/api/auth/nanna/verify` | 验证南哪小帮手验证码并签发 NanE JWT |
| `GET` | `/api/me` | 当前用户与联系方式额度 |
| `GET` | `/api/me/items` | 我的发布，需要认证 |

### 物品

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/items` | 首页列表，游客可用 |
| `GET` | `/api/items/:id` | 物品详情，游客可用 |
| `POST` | `/api/items` | 发布物品，需要认证 |
| `POST` | `/api/items/:id/contact` | 查看联系方式，需要认证 |
| `POST` | `/api/items/:id/claim` | 领取者提醒发布者确认领取 |
| `POST` | `/api/claims/:id/confirm` | 发布者确认领取并扣减数量 |
| `POST` | `/api/claims/:id/reject` | 发布者忽略领取提醒 |

### 管理后台

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/login` | 管理员登录 |
| `GET` | `/api/admin/items` | 管理员查询物品 |
| `POST` | `/api/admin/items/:id/approve` | 审核通过 |
| `POST` | `/api/admin/items/:id/reject` | 驳回 |
| `POST` | `/api/admin/items/:id/take-down` | 下架 |
| `GET` | `/api/admin/stats` | 后台统计 |

## 本地运行

准备 PostgreSQL：

```bash
createdb nane
cp .env.example .env
```

编辑 `.env`，至少设置：

```text
PORT=37878
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nane
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSWORD=replace-with-a-strong-admin-password
NANNA_API_BASE=https://assistant.example.com
NANNA_APP_UID=replace-with-nanna-app-uid
NANNA_API_KEY=replace-with-nanna-api-key
```

安装依赖并启动：

```bash
npm install
npm run dev:api
```

访问：

```text
http://localhost:37878/
http://localhost:37878/admin
http://localhost:37878/api/health
```

首次启动会自动执行 `server/schema.sql` 并插入 Demo 用户、默认管理员和种子物品。

默认管理员：

```text
用户名：admin
密码：使用 ADMIN_PASSWORD；未设置时为 nane-admin-demo
```

## 服务器部署

当前生产部署：

```text
VM: nane-vm
Region: Korea Central
OS: Ubuntu 24.04
Size: Standard B2ats_v2
Public IP: 72.155.72.104
API domain: api.zylatent.com
Web/Admin domain: nane.zylatent.com
Node local port: 37878
Process manager: PM2, process name nane-api
```

服务器更新：

```bash
cd ~/apps/NanE
git pull
pm2 restart nane-api --update-env
```

检查：

```bash
curl https://api.zylatent.com/api/health
```

常用日志：

```bash
pm2 logs nane-api --lines 100
pm2 info nane-api
```

Nginx 反向代理示例：

```nginx
server {
  listen 443 ssl;
  server_name nane.zylatent.com api.zylatent.com;

  location / {
    proxy_pass http://127.0.0.1:37878;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 合规与安全

项目在产品和技术上做了以下限制：

- 所有物品免费互助。
- 药品只允许非处方常见笼统分类。
- 禁止处方药、管控药、收费交易、拆封不明药品。
- 发布内容需人工审核。
- 游客不可查看联系方式。
- 宿舍号不对普通浏览者公开。
- 联系方式每日查看次数有限制。
- 南哪小帮手 API Key 只存服务器 `.env`，不进入前端和 Git 仓库。

## 后续路线

近期：

1. 实测南哪小帮手 challenge / verify 真实链路。
2. 给认证日志增加脱敏记录，方便排查登录问题。
3. 网页发布页接入和小程序一致的校区 / 楼栋 / 宿舍号下拉数据。
4. 增加“退出登录”“联系方式设置/补全”“当前身份展示”。
5. 管理后台增加搜索、类型筛选和认证用户信息展示。

中期：

1. 完善移动端网页体验。
2. 增加过期自动下架。
3. 增加图片上传和内容安全审核。
4. 增加消息通知或审核结果提示。
5. 准备演示视频、PPT 和比赛提交材料。

长期：

1. 小程序备案完成后恢复小程序上线流程。
2. 将 Web 稳定版本封装为 Tauri / EXE。
3. 引入更细的审计、风控和管理员权限管理。

## 配套文档

- `PROJECT_CONTEXT.md`：项目上下文和快速恢复说明。
- `docs/development-log.md`：开发日志。
- `docs/miniprogram-release-checklist.md`：微信小程序上线配置清单。
- `docs/privacy-guideline-draft.md`：隐私保护指引草稿。
- `docs/demo-script.md`：演示脚本。

## 仓库

GitHub：

```text
https://github.com/ZhouYinLong-lab/NanE
```
