# NanE 南易开发日志

## 2026-06-04

### 目标确认

- 项目目标从单纯 UI 原型调整为两小时内完成可演示 Demo。
- 最终方向确认：NanE（南易）校园互助平台，面向微信小程序，并开放可部署到服务器的 API。

### 已完成

- 搭建 Node.js 后端 API，无外部依赖，便于快速部署。
- 使用 `server/data/db.json` 作为 Demo 数据源，支持演示写入。
- 完成核心 API：
  - `GET /api/health`
  - `POST /api/auth/wx-login`
  - `GET /api/me`
  - `GET /api/me/items`
  - `GET /api/items`
  - `GET /api/items/:id`
  - `POST /api/items`
  - `POST /api/items/:id/contact`
- 搭建原生微信小程序工程：
  - 首页：搜索、分类、同楼栋优先排序展示
  - 详情页：物品信息、风险提示、查看联系方式
  - 发布页：提交互助物品并进入审核状态
  - 我的页：用户信息、额度、API 状态
  - 我的发布页：查看自己发布的审核/上架状态
- 抽离小程序 API 环境配置到 `miniprogram/config.js`。
- 接入 `wx.login` 调用入口，后端暂以 Demo 登录返回固定用户。
- 编写 `README.md`，包含运行方式、API 合约和部署建议。

### 验证记录

- `node --check server/index.js` 通过。
- `GET /api/me` 正常返回 Demo 用户和联系方式查看额度。
- `GET /api/items` 正常返回 3 条上线物品。
- `POST /api/items/:id/contact` 可返回联系方式并递减额度。
- `POST /api/items` 可写入审核中物品。

### 待办

- 替换真实微信小程序 AppID。
- 将 `miniprogram/config.js` 生产 API 域名改为服务器 HTTPS 域名。
- 后端替换 Demo 登录为微信 `code2Session` 和南哪助手认证。
- 后端数据源从 JSON 替换为 PostgreSQL。
- 联系方式限流从 JSON 记录替换为 Redis。
- 增加管理员审核后台。
- 增加图片上传与内容安全审核。
- 准备小程序隐私保护指引和药品/耗材发布规范。
