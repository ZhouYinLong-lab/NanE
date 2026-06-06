# NanE 项目上下文 Project Context

## 1. 项目概述 / Project Overview

- 项目名称：NanE（南易）
- 项目目标：面向南京大学校园场景的应急耗材互助信息平台，最终部署为微信小程序 + 服务器 API + 管理后台。
- 核心定位：校园互助信息撮合；免费共享；禁止处方药、管控药和收费转让；发布内容需人工审核。
- 目标用户：南京大学学生；管理员为项目团队/审核人员。
- 当前进度：小程序基础功能、PostgreSQL 后端、轻量 Web 管理后台、位置选择与自动识别均已实现并推送到 GitHub；Azure VM 生产服务器已创建，Nginx + HTTPS 已配置，公网 API 健康检查通过。

## 2. 技术栈 / Tech Stack

- 小程序：微信原生小程序，WXML / WXSS / JS。
- 后端：Node.js 18+，原生 `http` 服务，`pg` 访问 PostgreSQL。
- 数据库：PostgreSQL。
- 管理后台：同一个 Node 服务内的轻量 HTML 管理页 `/admin`，不引入 React 构建。
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
```

- 小程序端：
  - 首页：浏览审核通过的互助物品，同楼栋/同校区优先排序。
  - 发布页：发布物品，填写校区、楼栋，宿舍号选填，提交后进入审核。
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

- 发布互助物品：白名单分类、数量、有效期、校区/楼栋、宿舍号选填、免责声明确认。
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
- 新视觉设计：
  - 已根据 `campus_share_ui.html` 的组件风格迁移到小程序原生页面。
  - 当前 UI 使用米褐校园底色 + 南大紫强调色，并本地内置 Font Awesome 字体作为图标资源。

## 5. 最近更新 / Recent Changes

- `971242f Restore home rendering fallback`
  - 修复首页空白风险，移除首页 `wx:else` 条件链，改为显式 `wx:if`。
  - 图标绑定降级为稳定字段和可读字符兜底，避免字体加载问题导致页面主体不可见。
- `feacfbe Apply Nanjing University themed UI`
  - 小程序 UI 调整为米褐校园底色 + 南大紫强调 + `campus_share_ui.html` 组件风格。
  - 本地内置 Font Awesome Free 字体资源和图标映射。
- `750b72c Refine publish rules and contact validation`
  - 发布页规则提示改为轻量说明。
  - 联系方式改为微信/QQ 至少填写一项。
- `6178025 Add campus building room picker`
  - 接入校区/楼栋/宿舍号数据。
  - 发布表单新增三级选择和快速识别。
  - 后端新增 `room` 字段，普通用户不公开展示。
- `aceda18 Apply new mini program visual design`
  - 替换小程序整体美术风格。
- `8596445 Use dedicated NanE service port`
  - NanE 服务统一使用端口 `37878`，避免与其他服务冲突。
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
- 微信登录：
  - 当前 `/api/auth/wx-login` 仍为 Demo 登录，后续需替换为真实 `wx.login` + `code2Session`。

## 7. 后续计划 / Next Steps

1. 小程序生产配置：
   - `miniprogram/config.js` 的 `prod.apiBase` 已设为 `https://api.zylatent.com/api`。
   - `env` 已从 `dev` 切换为 `prod`。
2. 微信小程序后台：
   - 服务类目选“信息查询”。
   - 配置 request 合法域名为 `https://api.zylatent.com`。
   - 提交隐私保护指引。
3. 真实身份能力：
   - 替换 Demo 登录。
   - 确认是否对接校园身份认证，不占用“南哪小帮手”服务。

## 8. 关键文件 / Reference Files

- `README.md`：运行、API、部署说明。
- `docs/development-log.md`：开发日志。
- `docs/miniprogram-release-checklist.md`：微信小程序上线清单。
- `docs/privacy-guideline-draft.md`：隐私保护指引草稿。
- `docs/demo-script.md`：演示脚本。
- `server/index.js`：Node API 和管理后台入口。
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
