# NanE 南易互助平台

NanE（南易）是面向南京大学校园场景的药品/医疗耗材互助平台。当前版本是一版可运行的初始 Demo，用于打通微信小程序端浏览、发布、查看联系方式，以及后端 API 数据流。

## 当前打通的链路

- 小程序端：首页按分类/关键词浏览互助物品，同楼栋优先排序
- 小程序端：详情页查看物品信息，点击后调用 API 获取联系方式
- 小程序端：发布页提交物品，后端写入审核队列
- 小程序端：我的页显示校园身份、联系方式查看额度、API 连接状态
- 后端 API：健康检查、登录 Demo、物品列表、物品详情、发布物品、联系方式限流

## 本地运行

```bash
npm run dev:api
```

服务默认启动在：

```text
http://localhost:3000
```

微信开发者工具导入本目录，项目配置已写在 `project.config.json`。小程序端默认请求：

```text
http://localhost:3000/api
```

如部署到服务器，请修改 `miniprogram/config.js` 中的 `prod.apiBase` 为服务器 HTTPS 域名，并把 `env` 改为 `prod`，例如：

```js
const env = "prod";
```

正式小程序项目还需要把 `project.config.json` 中的 `appid` 替换为真实小程序 AppID。

## API 合约

### GET `/api/health`

检查服务状态。

### POST `/api/auth/wx-login`

Demo 登录接口，当前返回固定用户和 `demo-token`。后续可替换为微信 `code2Session` + 南哪助手认证。

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
  "expireDate": "2026-12-31",
  "description": "未拆封，晚上可自取"
}
```

### POST `/api/items/:id/contact`

查看发布者联系方式。Demo 中每人每天最多 5 次，记录保存在 `server/data/db.json`。

## 部署建议

当前后端无外部依赖，可直接用 Node 18+ 运行。服务器部署时建议：

- 使用 Nginx 反向代理到 Node 服务
- 配置 HTTPS，小程序正式环境必须使用合法 HTTPS 域名
- 在微信公众平台配置 `request 合法域名`
- 将 `server/data/db.json` 替换为 PostgreSQL
- 将联系方式查看限流迁移到 Redis
- 将 `/api/auth/wx-login` 替换为真实微信登录与校园认证

### 服务器启动示例

```bash
PORT=3000 npm start
```

Nginx 反向代理示例：

```nginx
server {
  listen 443 ssl;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 后续工程化路线

1. 数据库：用户、物品、审核记录、联系方式查看记录表
2. 审核后台：白名单分类、通过/驳回、过期自动下架
3. 登录认证：微信 OpenID + 南哪助手身份校验
4. 安全：接口鉴权、字段校验、联系方式脱敏、频控
5. 小程序：图片上传、我的发布、收藏、审核状态通知

## 开发日志

见 `docs/development-log.md`。
