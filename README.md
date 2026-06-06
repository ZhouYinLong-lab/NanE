# NanE 南易互助平台

NanE（南易）是面向南京大学校园场景的应急耗材互助信息平台。当前工程包含微信小程序、Node.js API、PostgreSQL 数据库和轻量 Web 管理后台，用于打通发布、审核、展示、联系方式限流和后台管理链路。

## 当前打通的链路

- 小程序端：首页按分类/关键词浏览互助物品，同楼栋优先排序
- 小程序端：详情页查看物品信息，点击后调用 API 获取联系方式
- 小程序端：发布页提交物品，后端写入审核队列
- 小程序端：我的页显示校园身份、联系方式查看额度、API 连接状态
- 后端 API：健康检查、登录 Demo、物品列表、物品详情、发布物品、联系方式限流
- 管理后台：管理员登录、待审列表、通过/驳回/下架、统计

## 环境变量

复制 `.env.example` 中的变量到服务器环境：

```text
PORT=37878
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nane
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSWORD=replace-with-a-strong-admin-password
```

## 本地运行

```bash
npm install
npm run dev:api
```

服务默认启动在：

```text
http://localhost:37878
```

微信开发者工具导入本目录，项目配置已写在 `project.config.json`。小程序端默认请求：

```text
http://localhost:37878/api
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

注意：`prod.apiBase` 已配置为该地址，但默认 `env` 仍为 `dev`，便于本地开发。微信后台合法域名配置完成后，再切换为 `prod`。

正式小程序项目还需要把 `project.config.json` 中的 `appid` 替换为真实小程序 AppID。

## API 合约

### GET `/api/health`

检查服务状态。

### POST `/api/auth/wx-login`

Demo 登录接口，当前返回固定用户和 `demo-token`。后续可替换为微信 `code2Session` + 校园身份认证。注意：NanE 不占用“南哪小帮手”服务，只预留未来对接能力。

### GET `/api/me`

返回当前用户信息，以及今日联系方式查看额度。

### GET `/api/items`

查询物品列表。

可选参数：

- `keyword`: 关键词
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
  "category": "消毒护理",
  "quantity": 20,
  "unit": "支",
  "campus": "仙林校区",
  "building": "南苑 A 栋",
  "room": "321",
  "expireDate": "2026-12-31",
  "description": "未拆封，晚上可自取"
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
- 确认后将小程序 `env` 从 `dev` 切换为 `prod`。

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

1. 登录认证：微信 OpenID + 校园身份认证
2. 审核后台：白名单分类、过期自动下架、管理员账号管理
3. 安全：接口鉴权、字段校验、联系方式脱敏、频控
4. 小程序：图片上传、收藏、审核状态通知
5. 部署：公网 HTTPS API、Nginx Proxy Manager、微信 request 合法域名

## 配套文档

- 微信小程序上线配置清单：`docs/miniprogram-release-checklist.md`
- 隐私保护指引草稿：`docs/privacy-guideline-draft.md`
- 演示脚本：`docs/demo-script.md`

## 开发日志

见 `docs/development-log.md`。
