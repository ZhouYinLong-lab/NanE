# NanE 项目上下文 Project Context

## 1. 项目概述 / Project Overview

- 项目名称：NanE（南易）
- 项目目标：面向南京大学校园场景的免费互助信息平台，当前优先上线微信小程序，后续扩展 Web 站点和桌面 EXE，三端共用服务器 API、PostgreSQL 和审核后台。
- 核心定位：校园互助信息撮合；免费共享；禁止处方药、管控药和收费转让；发布内容需人工审核。
- 目标用户：南京大学学生；管理员为项目团队/审核人员。
- 当前进度：小程序基础功能、网页端初版、PostgreSQL 后端、轻量 Web 管理后台、位置选择与自动识别、耗材/非处方药品模型、物品图标、同宿舍群推荐排序均已实现；Azure VM 生产服务器已创建，Nginx + HTTPS 已配置，公网 API 健康检查通过。

## 2. 技术栈 / Tech Stack

- 小程序：微信原生小程序，WXML / WXSS / JS。
- 后端：Node.js 18+，原生 `http` 服务，`pg` 访问 PostgreSQL。
- 数据库：PostgreSQL。
- 管理后台：同一个 Node 服务内的轻量 HTML 管理页 `/admin`，不引入 React 构建。
- Web：原生 HTML/CSS/JS，位于 `web/`，由同一 Node 服务托管，入口为 `https://nane.zylatent.com`。
- 未来 EXE：建议使用 Tauri 封装 Web 客户端；Electron 可作为备选。
- 服务端口：NanE 专用端口 `37878`。
- 本地/旧部署入口：Nginx Proxy Manager / frp 可反向代理到 `http://192.168.6.152:37878`。
- 当前 Azure 部署入口：`api.zylatent.com`、`nane.zylatent.com` 解析到 Azure VM 公网 IP `72.155.72.104`，通过 Nginx + Let's Encrypt HTTPS 反向代理到 `http://127.0.0.1:37878`。
- 远程仓库：[ZhouYinLong-lab/NanE](https://github.com/ZhouYinLong-lab/NanE)

## 3. 系统架构 / System Architecture

```text
微信小程序
  -> HTTPS API 域名
  -> Azure VM Nginx
  -> http://127.0.0.1:37878
  -> NanE Node API
  -> PostgreSQL

管理员浏览器
  -> https://nane.zylatent.com/admin
  -> 同一个 NanE Node API
  -> PostgreSQL

网页版
  -> https://nane.zylatent.com
  -> 同一 NanE Node 服务
  -> 同一套 HTTPS API
  -> PostgreSQL

未来 EXE
  -> 封装 Web 客户端
  -> 同一套 HTTPS API
  -> PostgreSQL
```

- 小程序端：
  - 首页：浏览审核通过的互助物品，同楼栋 > 同宿舍群 > 同校区 > 其他校区优先排序。
  - 发布页：发布耗材或非处方常见药品，填写校区、楼栋，宿舍号选填，提交后进入审核。
  - 详情页：展示物品信息，点击后调用联系方式查看 API。
  - 我的页：显示用户信息、查看额度、我的发布入口。
  - 我的发布：展示自己发布物品的审核状态；本人可看到自己填写的宿舍号。
- 后端 API：
  - 用户接口：登录 Demo、个人信息、物品列表、物品详情、发布、我的发布、查看联系方式。
  - 管理接口：管理员登录、待审列表、通过、驳回、下架、统计。
- 数据隐私：
  - 普通首页/详情只展示到楼栋，不公开宿舍号。
  - 宿舍号仅发布者本人和管理员可见。

## 4. 核心功能 / Core Features

- 发布互助物品：物品类型、数量、有效期、校区/楼栋、宿舍号选填、联系方式、图标选择、免责声明确认。
- 类型与分类：
  - 耗材：发布表单不要求选择细分类，后端默认保存为 `应急耗材`。
  - 药品：仅允许笼统非处方分类，如 `感冒药`、`退烧药`、`过敏药`、`肠胃药`、`其他非处方药`。
  - 后端兼容旧耗材分类：`退烧降温`、`消毒护理`、`外伤处理`、`防护用品`、`其他耗材`。
- 位置选择：
  - 使用 `miniprogram/data/locations.js` 内置位置数据。
  - 支持三级下拉：校区 / 楼栋 / 宿舍号。
  - 支持快速识别：如 `鼓楼 南二 321`、`仙林 4 321`、`浦口 10栋`。
- 审核流：
  - 发布后默认 `reviewing`。
  - 管理后台可通过、驳回、下架。
  - 审核动作写入 `review_logs`。
- 联系方式限流：
  - 每人每日最多查看 5 次。
  - 记录保存在 `contact_views`。
- 推荐排序：
  - 首页列表按同楼栋、同宿舍群、同校区、其他校区排序。
  - 仙林、苏州、浦口宿舍群规则已在 `server/proximity.js` 中维护。
- 物品图标：
  - `item_icon` 保存在数据库。
  - 小程序提供 20 个本地 Font Awesome 图标选项。
  - 默认耗材图标为 `plus`，默认药品图标为 `capsules`。
- 新视觉设计：
  - 已根据 `campus_share_ui.html` 的组件风格迁移到小程序原生页面。
  - 当前 UI 使用纯米色背景 + 南大纯紫 `#6E0065` 强调色，并本地内置 Font Awesome 字体作为图标资源。

## 5. 最近更新 / Recent Changes

- `b4cce15 Add item icons and simplify consumable category`
  - 耗材发布不再要求选择细分类，后端默认 `应急耗材`。
  - 药品兜底项改为 `其他非处方药`。
  - 发布表单新增 20 个 Font Awesome 物品图标选项，并持久化 `item_icon`。
- `d202899 Prioritize nearby dorm groups in item feed`
  - 首页排序升级为同楼栋 > 同宿舍群 > 同校区 > 其他校区。
  - 新增仙林、苏州、浦口宿舍群规则。
- `81f44d4 Add consumable and medicine item types`
  - 数据模型升级为 `item_type + category`。
  - 药品只接受非处方常见笼统分类。
- `37e96a4 Simplify publish rules copy`
  - 发布规则提示改为轻量可读文案。
- `013337d Add PostgreSQL API and admin review console`
  - 后端迁移到 PostgreSQL。
  - 新增 `/admin` 管理后台和管理员 API。

## 6. 当前问题 / Known Issues

- Azure 部署：
  - VM 已创建：`nane-vm`，区域 `Korea Central`，规格 `Standard B2ats_v2`，Ubuntu 24.04。
  - 公网 IP：`72.155.72.104`。
  - DNS 已生效：`api.zylatent.com`、`nane.zylatent.com` 均解析到 `72.155.72.104`。
  - 服务器本机 API 已启动：`curl http://127.0.0.1:37878/api/health` 返回正常。
  - HTTPS 已配置：`curl https://api.zylatent.com/api/health` 和 `curl https://nane.zylatent.com/api/health` 返回正常。
  - Certbot 自动续期 dry-run 成功，证书当前到期日为 2026-09-04。
  - 小程序生产 API 已切换：`miniprogram/config.js` 当前 `env = "prod"`，请求 `https://api.zylatent.com/api`。
  - 待完成：微信后台 request 合法域名保存后，在微信开发者工具刷新配置并回归测试主要页面。
- PostgreSQL：
  - 本地电脑未运行 PostgreSQL 时 `npm start` 会因 `ECONNREFUSED` 失败。
  - Azure VM 上已准备 NanE 专用 PostgreSQL 数据库和用户；敏感密码不写入仓库文档。
- 登录与身份：
  - 当前 `/api/auth/wx-login` 仍保留 Demo 登录，方便演示兜底。
  - 已新增小助手 challenge-code 身份验证入口：`/api/auth/nanna/challenge`、`/api/auth/nanna/verify`。
  - NanE 后端使用 `NANNA_API_KEY` 调用小助手接口，再签发 NanE 自己的 JWT；小程序端不保存第三方密钥。
  - 用户请求会优先根据 Bearer token 查当前 NanE 用户，没有有效 token 时降级为 Demo 用户。

## 7. 后续计划 / Next Steps

1. 小程序生产配置：
   - `miniprogram/config.js` 的 `prod.apiBase` 已设为 `https://api.zylatent.com/api`。
   - `env` 已从 `dev` 切换为 `prod`。
2. 微信小程序后台：
   - 服务类目选“信息查询”。
   - 配置 request 合法域名为 `https://api.zylatent.com`。
   - 提交隐私保护指引。
3. 真实身份能力：
   - 在服务器环境中配置 `NANNA_API_BASE`、`NANNA_APP_UID`、`NANNA_API_KEY`。
   - 用小程序“我的”页的身份验证卡片回归 challenge 和 verify 链路。
   - 建议 scope：`identity:basic:read`、`identity:student_id:read`、`identity:campus:read`，可选 `identity:major:read`。
   - 用户表后续可扩展 `auth_provider`、`student_id_masked`、`is_verified` 等字段。
4. 多端路线：
   - 小程序备案/审核较慢时，先使用 Web 站点完成演示和测试。
   - Web 站点复用 API 和数据库，承接桌面浏览与介绍页。
   - EXE 用 Tauri 或 Electron 封装 Web 客户端，避免重复实现业务逻辑。

## 8. 关键文件 / Reference Files

- `README.md`：运行、API、部署说明。
- `docs/development-log.md`：开发日志。
- `docs/miniprogram-release-checklist.md`：微信小程序上线清单。
- `docs/privacy-guideline-draft.md`：隐私保护指引草稿。
- `docs/demo-script.md`：演示脚本。
- `server/index.js`：Node API 和管理后台入口。
- `web/`：浏览器网页版，复用同一套 API。
- `server/schema.sql`：PostgreSQL schema。
- `server/db.js`：数据库初始化与种子数据。
- `miniprogram/config.js`：小程序 API 环境配置。
- `miniprogram/data/locations.js`：精简校区/楼栋/宿舍号数据。
- `miniprogram/utils/locations.js`：位置选择与自然语言识别逻辑。

---

> 维护说明：
> 1. 每次架构、部署、数据模型或关键功能变化后更新此文件。
> 2. 保持此文件能让新的开发者或 Codex 会话快速恢复上下文。
> 3. 若与 README 冲突，以 README 的运行命令为准，并同步修正本文。
