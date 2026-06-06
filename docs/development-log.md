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
- 后端替换 Demo 登录为微信 `code2Session` 和校园身份认证；NanE 不占用“南哪小帮手”服务。
- 后端数据源从 JSON 替换为 PostgreSQL。
- 联系方式限流从 JSON 记录替换为 Redis。
- 增加管理员审核后台。
- 增加图片上传与内容安全审核。
- 准备小程序隐私保护指引和药品/耗材发布规范。

### 第二轮：可上线工程化改造

- 后端从 JSON Demo 改为 PostgreSQL 数据层。
- 新增 `server/schema.sql`，启动时自动初始化核心表：
  - `users`
  - `items`
  - `contact_views`
  - `review_logs`
  - `admins`
- 新增轻量 Web 管理后台 `/admin`。
- 新增管理员接口：
  - `POST /api/admin/login`
  - `GET /api/admin/items`
  - `POST /api/admin/items/:id/approve`
  - `POST /api/admin/items/:id/reject`
  - `POST /api/admin/items/:id/take-down`
  - `GET /api/admin/stats`
- 小程序发布页增加白名单说明、免费互助声明和字段校验。
- 小程序首页增加合规说明、API 错误态和重试入口。
- 详情页强化免费互助、禁止处方药/管控药、自行判断风险提示。
- 我的发布页支持驳回原因和下架状态展示。
- 新增文档：
  - `.env.example`
  - `docs/miniprogram-release-checklist.md`
  - `docs/privacy-guideline-draft.md`
  - `docs/demo-script.md`

### 第三轮：校区/楼栋/宿舍号数据接入

- 从 `nju_electric_rooms_fixed.json` 生成小程序精简位置数据。
- 发布表单新增校区/楼栋/宿舍号三级选择，宿舍号可不填。
- 发布表单新增快速识别输入，支持类似“鼓楼 南二 321”“仙林 4 321”的位置解析。
- 后端 `items` 增加可空 `room` 字段，管理员后台和本人发布列表可见，普通首页/详情不公开。
- 隐私说明补充宿舍号仅供发布者本人和管理员核对。

## 2026-06-06

### UI 与 Azure 部署推进

- 小程序 UI 调整为米褐校园底色 + 南大紫强调色，并参考 `campus_share_ui.html` 的组件结构：
  - 首页：topbar、搜索框、分类 chips、引导 banner、双列物品卡。
  - 详情页：hero 图标、badge、信息卡、联系方式卡片。
  - 发布页：白卡表单、轻量规则提示、微信/QQ 至少一项联系方式。
  - 我的页：profile hero、统计卡、菜单卡片。
  - 我的发布：状态 chips、发布记录卡片。
- 本地内置 Font Awesome Free 字体文件：`miniprogram/assets/fontawesome/fa-solid-900.woff2`。
- 新增图标映射：`miniprogram/utils/icons.js`。
- 修复首页空白风险：
  - 首页列表渲染从 `wx:else` 改为显式 `wx:if`。
  - 图标值增加可读字符兜底，降低字体加载失败时的显示风险。

### Azure 服务器部署记录

- Azure for Students 已创建 VM：
  - 资源组：`nane-rg`
  - VM 名称：`nane-vm`
  - 区域：`Korea Central`
  - 系统：Ubuntu 24.04
  - 规格：`Standard B2ats_v2`，2 vCPU / 1GB 内存
  - 公网 IP：`72.155.72.104`
- 已添加 2GB swap，基础环境可用：
  - Node.js `v20.20.2`
  - npm `10.8.2`
  - PM2 `7.0.1`
  - PostgreSQL `16.14`
- 已在 VM 上创建 NanE PostgreSQL 数据库和用户，敏感密码不记录在仓库。
- 已拉取 GitHub 仓库并使用 PM2 启动 API：
  - PM2 进程名：`nane-api`
  - 本机端口：`37878`
  - 健康检查：`curl http://127.0.0.1:37878/api/health` 返回正常。
- DNS 已生效：
  - `api.zylatent.com -> 72.155.72.104`
  - `nane.zylatent.com -> 72.155.72.104`
- Nginx + Certbot HTTPS 已完成：
  - Let's Encrypt 证书签发成功，覆盖 `api.zylatent.com` 和 `nane.zylatent.com`。
  - 证书当前到期日：2026-09-04。
  - `curl https://api.zylatent.com/api/health` 返回正常。
  - `curl https://nane.zylatent.com/api/health` 返回正常。
  - `sudo certbot renew --dry-run` 模拟续期成功。
- 小程序生产 API 配置已更新：
  - `miniprogram/config.js` 中 `prod.apiBase` 为 `https://api.zylatent.com/api`。
  - 2026-06-07 已将默认环境切换为 `prod`，小程序请求生产 HTTPS API。

### 当前待办

- 微信公众平台配置 request 合法域名：`https://api.zylatent.com`。
- 微信开发者工具刷新项目配置，确认生产域名请求可用。
- 回归测试首页、详情、发布、我的发布和管理后台审核链路。
