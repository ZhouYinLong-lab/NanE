# NanE 南易互助平台

NanE（南易）是面向南京大学校园场景的免费互助信息平台。当前工程优先服务微信小程序上线，同时保留 Web 站点和桌面 EXE 的扩展路径；所有客户端最终共用同一套 Node.js API、PostgreSQL 数据库和审核后台。

## 当前打通的链路

- 小程序端：首页按关键词、类型和推荐距离浏览互助物品，同楼栋、同宿舍群、同校区依次优先
- 小程序端：UI 已切换为米色底、南大纯紫强调和线性附近物品列表，不再使用渐变主视觉
- 小程序端：详情页查看物品信息，点击后调用 API 获取联系方式
- 小程序端：发布页支持耗材 / 非处方常见药品、位置识别、图标选择、微信或 QQ 联系方式校验，提交后写入审核队列
- 小程序端：我的页显示校园身份、联系方式查看额度、API 连接状态
- 后端 API：健康检查、登录 Demo、物品列表、物品详情、发布物品、联系方式限流
- 管理后台：管理员登录、待审列表、通过/驳回/下架、统计

## 产品形态

- 微信小程序：当前主线，负责移动端发布、浏览、查看联系方式和我的发布。
- Web 站点：下一阶段可部署在 `https://nane.zylatent.com`，复用同一套 API 和 PostgreSQL，用于桌面浏览、管理和公开介绍。
- 桌面 EXE：建议以 Web 优先方式封装，后续可用 Tauri（优先）或 Electron 打包，不重新写一套业务后端。

推荐架构：

```text
微信小程序 / Web / EXE
  -> https://api.zylatent.com/api
  -> Azure VM Nginx
  -> NanE Node API :37878
  -> PostgreSQL
```

## 环境变量

复制 `.env.example` 中的变量到服务器环境：

```text
PORT=37878
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nane
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSWORD=replace-with-a-strong-admin-password
NANNA_API_BASE=https://assistant.example.com
NANNA_APP_UID=replace-with-nanna-app-uid
NANNA_API_KEY=replace-with-nanna-api-key
```

`NANNA_*` 变量用于下一阶段接入小助手身份验证。当前生产链路仍使用 Demo 登录，API Key 只能放在服务器环境变量中，不能写入小程序端。

## 本地运行

```bash
npm install
npm run dev:api
```

服务默认启动在：

```text
http://localhost:37878
```

微信开发者工具导入本目录，项目配置已写在 `project.config.json`。当前小程序端默认请求生产 API：

```text
https://api.zylatent.com/api
```

本地或服务器需要先准备 PostgreSQL 数据库，例如：

```bash
createdb nane
cp .env.example .env
```

然后按实际账号密码修改 `.env` 中的 `DATABASE_URL`。

如部署到服务器，请修改 `miniprogram/config.js` 中的 `prod.apiBase` 为服务器 HTTPS 域名，并把 `env` 改为 `prod`，例如：

```js
const env = "prod";
```

当前 Azure 部署计划中的生产 API 域名为：

```text
https://api.zylatent.com/api
```

注意：当前 `env` 已切换为 `prod`，小程序会请求 `https://api.zylatent.com/api`。如需本地开发，可临时改回 `dev`。

正式小程序项目还需要把 `project.config.json` 中的 `appid` 替换为真实小程序 AppID。

## API 合约

### GET `/api/health`

检查服务状态。

### POST `/api/auth/wx-login`

Demo 登录接口，当前返回固定用户和 `demo-token`。下一阶段计划接入小助手身份验证和账号系统：

1. 小程序或 Web 输入邮箱 / 学号等身份线索。
2. NanE 后端携带 `NANNA_API_KEY` 调用小助手 `/api/v1/oauth/challenge`。
3. 用户在小助手侧收到验证码。
4. NanE 后端调用 `/api/v1/oauth/verify` 验证 challenge code。
5. 验证成功后按小助手返回的 `openid` upsert NanE 用户，并签发 NanE 自己的 JWT。

建议申请的 scope：`identity:basic:read`、`identity:student_id:read`、`identity:campus:read`，可选 `identity:major:read`。

### GET `/api/me`

返回当前用户信息，以及今日联系方式查看额度。

### GET `/api/items`

查询物品列表。

可选参数：

- `keyword`: 关键词
- `itemType`: 物品类型，可选 `consumable` 或 `medicine`
- `category`: 分类
- `status`: 默认 `online`，可传 `all`

### GET `/api/items/:id`

查询物品详情。默认不返回发布者联系方式。

### POST `/api/items`

发布物品，当前状态为 `reviewing`。

示例：

```json
{
  "title": "医用棉签 20 支",
  "itemType": "consumable",
  "itemIcon": "bandage",
  "quantity": 20,
  "unit": "支",
  "campus": "仙林校区",
  "building": "南苑 A 栋",
  "room": "321",
  "expireDate": "2026-12-31",
  "description": "未拆封，晚上可自取"
}
```

耗材发布无需选择细分类；未传 `category` 时后端默认保存为 `应急耗材`。

药品类只接受笼统分类，例如：

```json
{
  "title": "未拆封感冒药一盒",
  "itemType": "medicine",
  "itemIcon": "capsules",
  "category": "感冒药",
  "quantity": 1,
  "unit": "盒",
  "campus": "仙林校区",
  "building": "南苑 A 栋",
  "expireDate": "2026-12-31",
  "description": "仅限非处方常见药品免费互助，管理员审核后展示"
}
```

### POST `/api/items/:id/contact`

查看发布者联系方式。当前每人每天最多 5 次，记录保存在 PostgreSQL 的 `contact_views` 表。

### POST `/api/admin/login`

管理员登录。返回用于管理接口的 Bearer token。

### GET `/api/admin/items`

管理员查询物品列表。可选参数：

- `status`: 默认 `reviewing`，可传 `online`、`rejected`、`taken_down`、`all`

### POST `/api/admin/items/:id/approve`

审核通过物品，状态变为 `online`。

### POST `/api/admin/items/:id/reject`

驳回物品，状态变为 `rejected`。请求体可传 `reason`。

### POST `/api/admin/items/:id/take-down`

管理员下架物品，状态变为 `taken_down`。

### GET `/api/admin/stats`

返回待审核、上架中、已下架和今日联系方式查看次数统计。

## 数据库初始化

首次启动会自动执行 `server/schema.sql` 并插入 Demo 用户、管理员和种子物品。

默认管理员：

```text
用户名：admin
密码：使用 ADMIN_PASSWORD；未设置时为 nane-admin-demo
```

## 管理后台

本地访问：

```text
http://localhost:37878/admin
```

管理后台与小程序共用 PostgreSQL 数据。管理员审核通过后，小程序首页刷新即可看到新物品。

## 部署建议

当前后端依赖 Node 18+ 和 PostgreSQL。服务器部署时建议：

- 使用 Nginx 反向代理到 Node 服务
- 配置 HTTPS，小程序正式环境必须使用合法 HTTPS 域名
- 在微信公众平台配置 `request 合法域名`
- 使用 PostgreSQL 存储用户、物品、审核记录和联系方式查看记录
- 后续可将联系方式查看限流迁移到 Redis
- 将 `/api/auth/wx-login` 替换为真实微信登录与校园认证

### 当前 Azure 部署信息

```text
VM: nane-vm
Region: Korea Central
OS: Ubuntu 24.04
Size: Standard B2ats_v2
Public IP: 72.155.72.104
API domain: api.zylatent.com
Admin/domain entry: nane.zylatent.com
Node API local port: 37878
Process manager: PM2, process name nane-api
```

已完成：

- `api.zylatent.com` 和 `nane.zylatent.com` 均已解析到 `72.155.72.104`。
- VM 本机 `curl http://127.0.0.1:37878/api/health` 返回正常。
- Nginx + Certbot HTTPS 已配置完成。
- `curl https://api.zylatent.com/api/health` 返回正常。
- `sudo certbot renew --dry-run` 成功。

待完成：

- 微信后台配置 request 合法域名 `https://api.zylatent.com`。
- 微信开发者工具刷新项目配置并回归测试首页、发布、详情、我的发布。

### 服务器启动示例

```bash
PORT=37878 npm start
```

Nginx 反向代理示例：

```nginx
server {
  listen 443 ssl;
  server_name api.zylatent.com;

  location / {
    proxy_pass http://127.0.0.1:37878;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 后续工程化路线

### 近期上线

1. 微信后台配置 `request 合法域名`：`https://api.zylatent.com`。
2. 微信开发者工具刷新项目配置，回归首页、发布、详情、我的发布、后台审核。
3. 补齐小程序基础资料、服务类目、隐私保护指引和审核说明。
4. 继续压测发布、审核、联系方式查看 5 次限流和到期字段校验。

### 账号与安全

1. 接入小助手 challenge-code 身份验证，替换 Demo 登录。
2. NanE 后端保存 `openid`、校园身份摘要、校区楼栋和联系方式，签发自己的 JWT。
3. 增加管理员账号管理、操作审计、联系方式脱敏展示和更严格频控。
4. 药品类继续保持笼统分类、人工审核、禁止处方药/管控药/收费交易。

### 多端产品

1. Web 站点：先做同 API 的响应式网页端，可承担介绍页、浏览页和管理增强。
2. EXE：Web 稳定后用 Tauri 打包桌面端，复用网页 UI 和 API。
3. 图片上传、收藏、消息通知、过期自动下架作为后续功能扩展，不影响当前 MVP 上线。

## 配套文档

- 微信小程序上线配置清单：`docs/miniprogram-release-checklist.md`
- 隐私保护指引草稿：`docs/privacy-guideline-draft.md`
- 演示脚本：`docs/demo-script.md`

## 开发日志

见 `docs/development-log.md`。
