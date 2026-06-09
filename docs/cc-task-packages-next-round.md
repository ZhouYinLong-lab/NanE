# NanE 下一轮任务包：我的发布、领取反馈、设置页、工具类型

生成时间：2026-06-09  
技能：`cc-dispatch`

## 理解确认

本轮问题不是单纯 UI 微调，而是四条产品链路调整：

1. **P1 功能逻辑错误**：`我的发布` 当前复用了发现页卡片点击详情逻辑，导致发布者点击自己的物品时可能进入领取者视角，并触发联系方式查看额度。这是核心业务错误，应优先修。
2. **P2 交互与反馈缺陷**：领取者发起领取提醒后，需要明确按钮状态；发布者的待确认提醒需要从“静默列表内容”升级为登录后主动弹窗。
3. **P3 信息架构调整**：`我的` 页应该回到轻量入口页，只显示账号卡片和“我的发布”入口；登录、资料、密码、通知、协议等配置迁移到新的 `设置` 页。
4. **P4 内容扩展**：新增第三种物品类型 `工具`，覆盖锤子、镊子、砂纸、热熔胶枪等偶发需求但不常备的物品。

建议执行顺序：

1. `TASK-NANE-MYITEM-005`
2. `TASK-NANE-CLAIM-006`
3. `TASK-NANE-SETTINGS-007`
4. `TASK-NANE-TOOLS-008`

理由：先修业务错误，再修提醒反馈，再做页面结构迁移，最后扩展类型模型。这样每一步都能独立验收。

---

## Task Package

**Task ID**: `TASK-NANE-MYITEM-005`  
**Title**: 拆分我的发布详情逻辑，避免消耗联系方式额度并增加编辑/下架入口  
**Priority**: P1  
**Estimated Scope**: 中（50-200 行）

---

### Context

当前 `web/app.js` 中 `myItemList` 点击自己的发布记录时复用 `openDetail()`，该详情逻辑服务于发现页/领取者视角，并通过 `viewContact()` 调用 `/api/items/:id/contact`，会消耗每日联系方式查看额度。发布者查看自己的发布时应看到完整信息，不应消耗额度，并应能编辑或下架。

相关文件：

- `web/app.js` — `renderItem()`、`openDetail()`、`viewContact()`、`loadMyItems()`、`myItemList` 点击事件
- `web/index.html` — 详情 dialog，可复用或新增 owner dialog
- `web/styles.css` — 我的发布详情、编辑/下架入口样式
- `server/index.js` — `/api/me/items`、`itemFromRow()`、现有 admin take-down 逻辑可参考
- `server/schema.sql` — 如需记录下架原因可扩展，否则不改
- `docs/test-guide.md` — 我的发布验收流程
- `docs/development-log.md` — 开发日志

---

### Requirements

1. `我的发布` 列表点击物品时，不再调用领取者详情逻辑 `openDetail(id)`。
2. 新增发布者详情视图，例如 `openMyItemDetail(id)`，数据来源优先使用 `/api/me/items` 已返回的数据；如需要单独接口，可新增 `/api/me/items/:id`。
3. 发布者详情必须展示完整信息：
   - 标题、类型、分类、数量、单位
   - 校区、楼栋、宿舍号
   - 有效期或长期有效
   - 补充说明
   - 微信、QQ
   - 审核状态、驳回原因、领取提醒
4. 发布者查看自己的联系方式不得调用 `/api/items/:id/contact`，不得写入 `contact_views`，不得改变今日查看额度。
5. 发布者详情提供“编辑”和“下架”入口。
6. 下架入口实现为普通用户只能下架自己发布的 `online` 或 `reviewing` 物品，状态改为 `taken_down`。
7. 编辑入口至少支持打开编辑表单并预填当前数据；若本轮控制范围，也可以只开放基础字段编辑：标题、数量、单位、有效期、长期有效、说明、联系方式。
8. 编辑后如果物品已上架，建议回到 `reviewing` 重新审核；如果实现不同策略，必须在完成报告说明。
9. 保留现有发现页详情和领取者查看联系方式逻辑不变。
10. 更新测试文档与开发日志。

---

### Constraints

- 不要让普通用户编辑或下架别人的物品。
- 不要在首页或普通详情页公开宿舍号。
- 不要绕过现有登录、用户协议、账号资料完整性检查。
- 不要删除现有领取确认功能。
- 不要把编辑功能做成管理后台专属。

---

### Acceptance Criteria

- [ ] AC-1：发布者点击“我的发布”中的物品，不会调用 `/api/items/:id/contact`。
- [ ] AC-2：发布者详情展示宿舍号、微信、QQ。
- [ ] AC-3：发布者查看自己的联系方式不减少今日查看额度。
- [ ] AC-4：发布者详情有“编辑”和“下架”入口。
- [ ] AC-5：发布者可下架自己的上架物品，下架后首页不再展示。
- [ ] AC-6：普通用户不能下架或编辑他人的物品。
- [ ] AC-7：发现页物品详情和查看联系方式仍按原逻辑工作。
- [ ] AC-8：`node --check server/index.js` 与 `node --check web/app.js` 通过。

---

### Test Expectations

```bash
node --check server/index.js
node --check web/app.js
```

手动回归：

1. A 登录，进入我的发布，点击自己的物品。
2. 确认展示宿舍号、微信、QQ。
3. 记录今日查看额度，确认点击自己的发布不消耗额度。
4. A 下架该物品，首页确认不再展示。
5. B 尝试通过接口下架 A 的物品，应返回 403。

---

## Task Package

**Task ID**: `TASK-NANE-CLAIM-006`  
**Title**: 完善领取按钮状态反馈并将发布者提醒改为主动弹窗  
**Priority**: P2  
**Estimated Scope**: 中（50-200 行）

---

### Context

当前领取者点击“我已联系并领取，提醒发布者确认”后，页面只显示结果文本，按钮仍可能保持可点击，反馈不够明确。发布者侧虽然已有顶部提醒区和我的发布内提醒，但仍需要主动弹窗，避免发布者错过待确认领取。

相关文件：

- `web/app.js` — `requestClaim()`、`renderClaimsBanner()`、`loadMyItems()`、URL focus claims 逻辑
- `web/index.html` — 可新增领取提醒弹窗 dialog
- `web/styles.css` — claim button disabled、claim modal 样式
- `server/index.js` — `/api/items/:id/claim` 已返回重复提醒状态
- `docs/test-guide.md` — 领取确认验收
- `docs/development-log.md` — 开发日志

---

### Requirements

1. 领取者点击 `claimButton` 后，按钮立即进入 loading/disabled 状态，避免重复点击。
2. 请求成功后，按钮保持灰色禁用。
3. 请求成功后的按钮文案统一改为：`您已提醒过发布者确认领取，请等待对方处理`。
4. 如果接口返回“你已提醒过发布者确认领取，请等待对方处理”，前端也应进入同样 disabled 状态。
5. 请求失败时恢复按钮可点击，并展示错误信息。
6. 发布者登录或进入“我的”页后，如果存在待确认领取请求，主动弹出 modal。
7. 弹窗内容包含：
   - 标题：`有待确认的领取提醒`
   - 物品标题
   - 领取者昵称
   - 领取数量
   - 确认 / 忽略按钮
8. 弹窗一次展示所有待确认提醒；确认或忽略后更新弹窗内容。
9. 若所有提醒处理完，自动关闭弹窗并刷新我的发布列表。
10. 为避免过度打扰，同一批提醒在同一次页面会话中只自动弹出一次；用户仍可从“我的发布”或顶部提醒入口再次查看。
11. 更新测试文档与开发日志。

---

### Constraints

- 不要移除顶部待确认提醒区；弹窗是主动提醒，顶部区是备用入口。
- 不要让领取者在未查看联系方式前发起领取提醒。
- 不要改变服务端防重复 pending claim 的逻辑。
- 不要使用浏览器 `alert()` 作为最终弹窗实现。

---

### Acceptance Criteria

- [ ] AC-1：领取者点击领取提醒按钮后，按钮立即 disabled。
- [ ] AC-2：成功后按钮文案变为 `您已提醒过发布者确认领取，请等待对方处理`。
- [ ] AC-3：重复点击/重复请求不会创建多个 pending claim，且前端显示等待处理状态。
- [ ] AC-4：请求失败时按钮恢复可点击。
- [ ] AC-5：发布者登录或进入“我的”页后，如有待确认领取，主动弹出弹窗。
- [ ] AC-6：弹窗内可确认或忽略领取提醒。
- [ ] AC-7：所有提醒处理完成后弹窗关闭，列表和首页状态同步更新。
- [ ] AC-8：`node --check web/app.js` 通过。

---

### Test Expectations

```bash
node --check web/app.js
```

手动回归：

1. B 查看 A 的联系方式后点击领取提醒。
2. 确认按钮禁用且文案变更。
3. B 刷新详情后再次点击，确认仍提示已提醒，不重复创建。
4. A 登录或进入“我的”，确认弹窗主动出现。
5. A 在弹窗内确认，确认数量扣减或自动下架。

---

## Task Package

**Task ID**: `TASK-NANE-SETTINGS-007`  
**Title**: 精简我的页并新增设置页  
**Priority**: P3  
**Estimated Scope**: 大（> 200 行）

---

### Context

当前网页端只有 `发现 / 发布 / 我的` 三个 tab。“我的”页承担了账号卡片、登录、资料维护、密码、南哪小帮手、我的发布等过多功能。新需求要求“我的”页只保留账号信息卡片和“我的发布”入口，并新增“设置”页承载外观、账号、通知、关于 NanE。

相关文件：

- `web/index.html` — tabs、我的页、登录区、账号资料表单
- `web/app.js` — tab 切换、登录/资料/密码逻辑、profile card 行为、logout/session
- `web/styles.css` — 我的页、设置页、深浅色主题
- `server/index.js` — 用户通知偏好可能需要新增接口
- `server/db.js` — 通知偏好如需落库需启动迁移
- `server/schema.sql` — 通知偏好字段
- `docs/user-agreement.md` — 设置页“关于 NanE”入口
- `docs/privacy-guideline-draft.md` — 隐私保护指引入口
- `docs/test-guide.md` — 设置页验收
- `docs/development-log.md` — 开发日志

---

### Requirements

1. 顶部/底部主导航新增 `设置` tab；网页端最终主导航为：`发现 / 发布 / 我的 / 设置`。
2. “我的”页只保留：
   - 账号信息卡片
   - “我的发布”入口
   - 待确认领取提醒入口/摘要（如果 TASK-NANE-CLAIM-006 已完成，保留弹窗和入口）
3. 从“我的”页移除登录表单、账号资料编辑、密码设置、南哪小帮手登录、用户协议弹窗入口等设置类内容。
4. 新增“设置”页，包含四个区域：
   - 外观：深色 / 浅色模式切换
   - 账号：登录、修改资料、修改密码、登出
   - 通知：领取提醒邮件开关
   - 关于 NanE：用户协议、隐私保护指引、版本号
5. 未登录用户进入“设置”页时，账号区展示登录方式；登录后展示资料编辑、修改密码、登出。
6. “修改资料”复用现有昵称、校区、楼栋、宿舍号表单。
7. “修改密码”复用现有设置/重置密码能力；不要要求用户重新写邮箱后缀。
8. “登出”清空本地 token/user，并刷新首页与我的页状态。
9. 外观切换：
   - 支持浅色 / 深色
   - 保存到 `localStorage`
   - 页面刷新后保留
   - 深色模式至少覆盖背景、卡片、文字、按钮、输入框、弹窗
10. 通知开关：
   - 增加用户级 `claim_email_enabled` 或同等字段，默认开启
   - 关闭后，领取提醒仍创建站内提醒，但不发送邮件
   - 设置页可以切换并保存
11. 关于 NanE：
   - 用户协议可打开现有协议内容
   - 隐私保护指引可打开 `docs/privacy-guideline-draft.md` 内容或后端新增静态接口
   - 版本号读取 `package.json` 或前端常量，至少显示当前版本
12. 更新测试文档与开发日志。

---

### Constraints

- 不要破坏现有邮箱验证码、密码登录、南哪小帮手登录。
- 不要让未登录用户看到需要登录后才能操作的资料保存接口。
- 不要把“我的发布”入口藏到设置页；我的页必须仍能快速进入我的发布。
- 不要引入 React/Vue 等框架。
- 不要改动小程序端。

---

### Acceptance Criteria

- [ ] AC-1：主导航出现 `设置`。
- [ ] AC-2：“我的”页只显示账号卡片和我的发布入口/摘要，不再出现登录表单和资料表单。
- [ ] AC-3：“设置”页包含外观、账号、通知、关于 NanE 四个区域。
- [ ] AC-4：未登录用户可在设置页登录。
- [ ] AC-5：已登录用户可在设置页修改资料、修改密码、登出。
- [ ] AC-6：深色/浅色模式可切换并持久化。
- [ ] AC-7：关闭领取提醒邮件后，站内提醒仍创建，但不发送邮件。
- [ ] AC-8：用户协议和隐私保护指引可从设置页打开。
- [ ] AC-9：`node --check server/index.js`、`node --check server/db.js`、`node --check web/app.js` 通过。

---

### Test Expectations

```bash
node --check server/index.js
node --check server/db.js
node --check web/app.js
```

手动回归：

1. 未登录：我的页只显示游客账号卡片和入口；设置页可登录。
2. 登录：设置页可修改资料、修改密码、登出。
3. 深色模式刷新后保留。
4. 关闭邮件提醒后，B 发起领取提醒，A 不收邮件但站内提醒存在。
5. 重新开启邮件提醒后，A 可收到邮件。

---

## Task Package

**Task ID**: `TASK-NANE-TOOLS-008`  
**Title**: 增加工具物品类型  
**Priority**: P4  
**Estimated Scope**: 中（50-200 行）

---

### Context

当前 NanE 物品类型只有 `consumable` 和 `medicine`。新需求要求新增第三种类型 `工具`，覆盖偶有需求但不常备的工具，例如锤子、镊子、砂纸、热熔胶枪等。

相关文件：

- `server/index.js` — `ITEM_TYPES`、`validateItemInput()`、`itemFromRow()`、列表筛选
- `server/db.js` — 种子数据如需增加工具示例
- `web/index.html` — 发布页类型 segmented、首页筛选 chips
- `web/app.js` — `setPublishType()`、图标选择、payload category、筛选参数
- `web/styles.css` — 类型/筛选样式，如需调整
- `miniprogram/pages/publish/*` — 如本轮仅网页端可不改；若保持跨端模型一致则同步
- `docs/test-guide.md` — 工具类型验收
- `docs/development-log.md` — 开发日志
- `docs/miniprogram-release-checklist.md` — 如同步小程序模型则更新

---

### Requirements

1. 后端 `ITEM_TYPES` 新增：
   - key: `tool`
   - text: `工具`
   - defaultCategory: `常用工具`
   - defaultIcon: 建议 `screwdriverWrench` 或现有可用工具图标；如 Font Awesome 映射缺失，则先用 `box`
   - categories: `常用工具`、`维修工具`、`手工工具`、`清洁工具`、`其他工具`
2. 后端 `POST /api/items` 接受 `itemType=tool`。
3. 工具类型不要求有效期；应支持 `长期有效 / 无保质期`。
4. 工具类型允许发布数量、单位、说明、联系方式、位置，仍需人工审核。
5. 首页筛选新增 `工具` chip；点击后请求 `/api/items?itemType=tool`。
6. 发布页物品类型新增 `工具` 分段按钮。
7. 工具类型提示文案：
   - `适用于锤子、镊子、砂纸、热熔胶枪等偶发需求但不常备的小工具。请约定归还方式或说明是否赠送。`
8. 工具类型标题 placeholder 建议：
   - `例如：热熔胶枪借用`
9. 工具默认图标和常用图标选项偏向工具类；如果现有 Font Awesome 映射不足，补充本地图标映射。
10. 列表、详情、我的发布、管理后台展示 `工具` 类型文本和分类。
11. 若现有 seed 数据需要展示工具，可新增 1 条审核通过的工具示例。
12. 更新测试文档与开发日志。

---

### Constraints

- 不要改变药品白名单与药品必须填写有效期的限制。
- 不要让工具类型进入药品合规提示。
- 不要要求工具上传图片。
- 不要破坏已有耗材/药品发布逻辑。
- 如果同步小程序端，保持字段名仍为 `itemType`，不要新增并行字段。

---

### Acceptance Criteria

- [ ] AC-1：发布页可选择 `工具`。
- [ ] AC-2：工具类型可选择或默认使用工具分类。
- [ ] AC-3：工具类型可设置长期有效 / 无保质期。
- [ ] AC-4：提交工具后状态为 `reviewing`。
- [ ] AC-5：管理员审核通过后首页可见。
- [ ] AC-6：首页点击 `工具` chip 只展示工具类型物品。
- [ ] AC-7：工具详情和我的发布展示类型为 `工具`。
- [ ] AC-8：耗材、药品原有发布与筛选不回归。
- [ ] AC-9：`node --check server/index.js` 和 `node --check web/app.js` 通过。

---

### Test Expectations

```bash
node --check server/index.js
node --check web/app.js
```

手动回归：

1. 发布 `工具 / 常用工具 / 热熔胶枪借用`，设置长期有效。
2. 管理后台审核通过。
3. 首页点击 `工具` chip，确认该物品出现。
4. 点击 `非处方药品`，确认工具不出现。
5. 发布药品，确认仍必须填写有效期。
