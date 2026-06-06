# NanE 项目上下文 Project Context

## 1. 项目概述 / Project Overview

- 项目名称：NanE（南易）
- 项目目标：面向南京大学校园场景的应急耗材互助信息平台，最终部署为微信小程序 + 服务器 API + 管理后台。
- 核心定位：校园互助信息撮合；免费共享；禁止处方药、管控药和收费转让；发布内容需人工审核。
- 目标用户：南京大学学生；管理员为项目团队/审核人员。
- 当前进度：小程序基础功能、PostgreSQL 后端、轻量 Web 管理后台、位置选择与自动识别均已实现并推送到 GitHub。

## 2. 技术栈 / Tech Stack

- 小程序：微信原生小程序，WXML / WXSS / JS。
- 后端：Node.js 18+，原生 `http` 服务，`pg` 访问 PostgreSQL。
- 数据库：PostgreSQL。
- 管理后台：同一个 Node 服务内的轻量 HTML 管理页 `/admin`，不引入 React 构建。
- 服务端口：NanE 专用端口 `37878`。
- 部署入口：Nginx Proxy Manager / frp 反向代理到 `http://192.168.6.152:37878`。
- 远程仓库：[ZhouYinLong-lab/NanE](https://github.com/ZhouYinLong-lab/NanE)

## 3. 系统架构 / System Architecture

```text
微信小程序
  -> HTTPS API 域名
  -> Nginx Proxy Manager / frp
  -> http://192.168.6.152:37878
  -> NanE Node API
  -> PostgreSQL

管理员浏览器
  -> /admin
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
  - 已根据 `C:\Users\26585\Downloads\index.html` 迁移到小程序原生页面。

## 5. 最近更新 / Recent Changes

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

- 服务器域名访问限制：
  - 如果 `nane.lilystudio.space` 只能校园网访问，则可用于校内演示，但不适合微信小程序正式版审核。
  - 小程序正式 request 合法域名应为公网可访问 HTTPS 域名。
- PostgreSQL：
  - 本地电脑未运行 PostgreSQL 时 `npm start` 会因 `ECONNREFUSED` 失败。
  - 服务器部署时应为 NanE 单独准备 PostgreSQL 数据库或容器，避免混用其他项目数据库。
- 微信登录：
  - 当前 `/api/auth/wx-login` 仍为 Demo 登录，后续需替换为真实 `wx.login` + `code2Session`。
- 未跟踪文件：
  - `PROJECT_CONTEXT.md` 此前为未跟踪文件；本次维护后应纳入仓库。

## 7. 后续计划 / Next Steps

1. 服务器部署：
   - 准备 NanE 专用 PostgreSQL。
   - 设置 `.env`：`PORT=37878`、`DATABASE_URL`、`JWT_SECRET`、`ADMIN_PASSWORD`。
   - 使用 PM2 或 systemd 启动 Node API。
   - 验证 `curl http://127.0.0.1:37878/api/health`。
2. Nginx Proxy Manager：
   - 新建 NanE 专用子域名。
   - Scheme 选 `http`。
   - Forward Hostname/IP 填 NanE API 所在机器，如 `192.168.6.152`。
   - Forward Port 填 `37878`。
   - SSL 开启 Force SSL 和 HTTP/2。
3. 微信小程序后台：
   - 服务类目选“信息查询”。
   - 配置 request 合法域名为公网 HTTPS API 域名。
   - 提交隐私保护指引。
4. 真实身份能力：
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
