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

### 管理后台审核列表修复

- 修复管理后台统计数正确但列表为空的问题：
  - 后台页面不再依赖 `status`、`items`、`username`、`password` 等浏览器全局变量。
  - 审核状态选择器改为显式读取 `#item-status`。
  - 列表容器改为显式读取 `#items`。
  - 列表加载失败时显示具体错误，不再静默表现为“暂无数据”。
- 后台列表渲染增加基础 HTML 转义，避免用户发布内容直接插入后台页面。
- 追加修复管理后台登录按钮无响应问题：
  - 将审核按钮从嵌套引号的内联调用改为 `data-id` / `data-action` 读取。
  - 增加后台内嵌脚本解析检查，避免 HTML 模板字符串生成后出现浏览器脚本错误。

### 小程序 UI 纯紫线性列表重构

- 小程序视觉从米褐渐变改为纯米色背景 + 南大纯紫 `#6E0065` 强调。
- 首页接入本地 NanE logo，并改为效果图方向的“南易 / CAMPUS MUTUAL AID / 筛选 chips / 线性附近物品列表”。
- 首页物品列表从双列卡片改为左侧图标块、右侧标题/位置/描述/数量标签的线性列表。
- 发布页、详情页、我的页、我的发布页去除渐变色，按钮、profile hero、active chips 等改为纯紫或黑色强调。
- 保留现有 3 栏微信原生 tabBar，不新增分类/消息页面。

### 发布分类模型重构

- 发布表单从单一分类升级为“物品类型 + 分类”：
  - 耗材：退烧降温、消毒护理、外伤处理、防护用品、其他耗材。
  - 药品：感冒药、退烧药、过敏药、肠胃药、其他非处方药。
- 后端 `items` 增加 `item_type` 字段，旧数据默认按 `consumable` 兼容。
- 首页、详情页、我的发布和管理后台展示“耗材 / 非处方药品”类型标签。
- 发布页增加耗材/药品各自提示，强调药品仅限非处方常见分类，禁止处方药、管控药、收费交易和拆封不明物品。

### 首页宿舍群推荐排序

- 首页推荐排序从“同楼栋 > 同校区 > 跨校区”升级为“同楼栋 > 同宿舍群 > 同校区 > 跨校区”。
- 新增后端宿舍群规则模块，覆盖仙林、苏州、浦口用户提供的临近宿舍群。
- 列表和详情的距离标签新增“同宿舍群”，不改变发布表单和位置选择逻辑。

### 发布表单图标与分类简化

- 耗材发布不再要求选择细分类，后端默认保存为“应急耗材”。
- 药品发布继续使用笼统分类，兜底项为“其他非处方药”。
- 发布表单新增“选择图标（可选）”，提供 20 个 Font Awesome 本地图标选项。
- 后端 `items` 新增 `item_icon` 字段，旧数据默认使用 `plus` 图标。

## 2026-06-07

### 项目文档与路线图同步

- 更新 README：
  - 明确当前主线为微信小程序上线。
  - 补充 Web 站点和 EXE 桌面端的后续产品形态。
  - 同步 Azure 生产域名、API 合约、耗材/药品发布规则和后续工程化路线。
- 更新 `PROJECT_CONTEXT.md`：
  - 补充当前技术栈、生产部署、宿舍群排序、物品图标和小助手账号系统方向。
  - 将未来架构整理为小程序 / Web / EXE 共用同一套 API 与 PostgreSQL。
- 更新上线与演示文档：
  - 小程序上线清单补充 `https://api.zylatent.com`、管理后台地址和发布校验点。
  - 隐私保护指引补充小助手身份、宿舍号保护、联系方式限流和药品合规边界。
  - 演示脚本补充宿舍群推荐、图标选择、联系方式二选一和多端路线说明。
- 更新早期项目书：
  - 将项目名称、技术方案和开发计划从早期假设同步为当前已落地工程状态。
