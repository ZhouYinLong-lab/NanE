# NanE 部署与运维指南

本文记录 NanE 当前生产部署方式、更新流程、常用排障命令和敏感配置注意事项。

## 1. 当前生产环境

| 项目 | 当前值 |
|------|--------|
| 云服务 | Azure VM |
| 区域 | Korea Central |
| 系统 | Ubuntu 24.04 |
| Node 服务端口 | `37878` |
| 进程管理 | PM2，进程名 `nane-api` |
| 数据库 | PostgreSQL |
| 网页域名 | `https://nane.zylatent.com` |
| API 域名 | `https://api.zylatent.com/api` |
| 管理后台 | `https://nane.zylatent.com/admin` |

服务结构：

```text
Nginx HTTPS
  -> http://127.0.0.1:37878
  -> Node server/index.js
  -> PostgreSQL
```

## 2. 环境变量

生产环境变量放在服务器项目目录的 `.env` 中，不进入 Git。

关键变量：

```text
PORT=37878
DATABASE_URL=postgres://...
JWT_SECRET=...
ADMIN_PASSWORD=...
NANNA_API_BASE=...
NANNA_APP_UID=...
NANNA_API_KEY=...
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=NanE 南易 <...>
PUBLIC_WEB_URL=https://nane.zylatent.com
MINIO_ENDPOINT=https://minio.example.com
MINIO_BUCKET=nane
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_PUBLIC_URL=https://static.example.com/nane
```

注意：

- `JWT_SECRET`、`ADMIN_PASSWORD`、`DATABASE_URL`、`NANNA_API_KEY`、`SMTP_PASS` 都是敏感信息。
- `MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY` 也是敏感信息。未配置 MinIO 时，图片会落到服务器本地 `uploads/` 目录，适合开发演示，不建议作为长期生产存储。
- 不要把 `.env`、截图或日志里的敏感值提交到仓库。
- 修改 `.env` 后需要使用 `pm2 restart nane-api --update-env`。

## 3. 更新部署

服务器上执行：

```bash
cd ~/apps/NanE
git pull
npm install
pm2 restart nane-api --update-env
```

检查：

```bash
curl https://api.zylatent.com/api/health
pm2 status
pm2 logs nane-api --lines 80
```

如果本轮改动包含数据库 schema，服务启动时 `initializeDatabase()` 会自动执行兼容迁移。

## 4. HTTPS 与 Nginx

当前 HTTPS 由 Let's Encrypt / Certbot 管理。

常用检查：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Nginx 反代核心配置：

```nginx
location / {
  proxy_pass http://127.0.0.1:37878;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 5. 数据库

后端依赖 PostgreSQL。首次启动会执行：

- `server/schema.sql`
- `server/db.js` 中的兼容迁移
- 种子用户、默认管理员和示例物品插入

常见需要关注的表：

- `users`
- `items`
- `contact_views`
- `claim_requests`
- `review_logs`
- `admins`
- `email_challenges`

排查数据库连接：

```bash
psql "$DATABASE_URL"
```

不要在公共文档中输出完整连接串。

## 6. 邮箱发送

邮箱验证码和领取确认邮件共用 SMTP 配置。

测试点：

- 邮箱验证码能收到。
- 领取者点击领取提醒后，发布者邮箱能收到“NanE 南易领取确认提醒”。
- 如果 SMTP 失败，站内领取提醒仍应保留。

查看相关日志：

```bash
pm2 logs nane-api --lines 120
```

常见 SMTP 问题：

- 授权码错误。
- 发信账号未开启 SMTP。
- QQ 邮箱限制登录或频率过高。
- `SMTP_FROM` 与授权账号不一致。

## 7. 常用排障

API 不通：

```bash
pm2 status
pm2 logs nane-api --lines 120
curl http://127.0.0.1:37878/api/health
curl https://api.zylatent.com/api/health
```

网页白屏：

```bash
curl https://nane.zylatent.com
pm2 logs nane-api --lines 120
```

数据库迁移报错：

```bash
pm2 logs nane-api --lines 200
```

重点看 `constraint`、`column`、`relation`、`DATABASE_URL`。

## 8. 上线前检查

- [ ] `git status` 干净或明确知道未提交文件。
- [ ] `node --check server/index.js` 通过。
- [ ] `node --check server/db.js` 通过。
- [ ] `node --check web/app.js` 通过。
- [ ] `curl https://api.zylatent.com/api/health` 正常。
- [ ] 管理后台可登录。
- [ ] 邮箱验证码可用。
- [ ] 发布、审核、查看联系方式、领取确认四条链路可用。
