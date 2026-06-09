# NanE 日期输入与联系方式计数修复任务包

生成时间：2026-06-09  
技能：`cc-dispatch`

## 理解确认

本轮包含两个问题：

1. **P1 有效期日期输入问题**：当前发布表单使用日历/日期输入框，用户手动修改年份、月份或日期时容易出错。期望改成类似 Google 的三段式输入/选择：年、月、日分开，不再依赖日历框选。
2. **P2 联系方式重复查看消耗额度问题**：用户已经查看过某个物品联系方式后，再次点击同一物品的“查看联系方式”不应再次扣减每日额度；退出详情后再次进入同一物品，也不应重复扣减。

建议执行顺序：

1. `TASK-NANE-DATE-009`
2. `TASK-NANE-CONTACT-010`

---

## Task Package

**Task ID**: `TASK-NANE-DATE-009`  
**Title**: 将有效期输入改为年月日三段式控件  
**Priority**: P1  
**Estimated Scope**: 中（50-200 行）

---

### Context

当前网页端发布表单使用单个 `input[type=date]` 作为有效期输入。测试反馈指出，手动输入年份、月份或日期时容易出错，希望改成类似 Google 的三段式输入，不再使用日历框选。

相关文件：

- `web/index.html` — 发布表单有效期字段
- `web/app.js` — `submitPublish()`、`startEditItem()`、`toggleNoExpiry()`、表单 reset 逻辑
- `web/styles.css` — 表单日期输入样式
- `server/index.js` — `validateItemInput()` 仍接收 `expireDate: YYYY-MM-DD`
- `docs/test-guide.md` — 发布表单验收
- `docs/development-log.md` — 开发日志

---

### Requirements

1. 将发布表单中的单个 `expireInput` 日期输入替换为三段式控件：
   - 年：四位年份
   - 月：1-12
   - 日：1-31，并根据年月校验合法日期
2. 不再使用 `input[type=date]` 或依赖浏览器日历框选。
3. 三段式控件最终仍组装为后端需要的 `expireDate: YYYY-MM-DD`。
4. 年份输入建议允许当前年份到当前年份 + 5 年；如果采用手动输入，必须校验范围。
5. 月、日可以使用 `<select>` 或短输入框；优先选择移动端更稳定的方式。
6. 选择或输入年月后，日选项应按当月天数更新；例如 2 月不会出现 30/31 日，闰年 2 月允许 29 日。
7. 药品类型仍必须填写有效期，且不能选择长期有效。
8. 耗材和工具类型仍可选择“长期有效 / 无保质期”；勾选后禁用年月日控件。
9. 编辑已有物品时，应能从 `YYYY-MM-DD` 正确回填年、月、日。
10. 提交成功后，日期控件重置为默认值，例如 `2026-12-31` 或项目当前默认值。
11. 前端错误提示要明确，例如：
    - `请选择有效年份`
    - `请选择有效月份`
    - `请选择有效日期`
12. 不改变后端 API 字段名；仍提交 `expireDate` 和 `noExpiry`。
13. 更新测试文档与开发日志。

---

### Constraints

- 不要改变药品必须填写有效期的合规逻辑。
- 不要改数据库字段。
- 不要引入大型日期库。
- 不要影响“长期有效 / 无保质期”逻辑。
- 不要改小程序端，本任务只针对网页端。

---

### Acceptance Criteria

- [ ] AC-1：发布表单不再出现浏览器原生日期选择框。
- [ ] AC-2：有效期以年、月、日三段式展示。
- [ ] AC-3：选择 `2027 / 2 / 29` 在非闰年时不可提交或不可选择。
- [ ] AC-4：药品类型未填写有效期时不能提交。
- [ ] AC-5：耗材/工具勾选长期有效后，年月日控件禁用，提交 `noExpiry=true`。
- [ ] AC-6：编辑已有物品时，`expireDate` 能正确回填三段控件。
- [ ] AC-7：提交给后端的 `expireDate` 格式仍为 `YYYY-MM-DD`。
- [ ] AC-8：`node --check web/app.js` 通过。

---

### Test Expectations

```bash
node --check web/app.js
```

手动回归：

1. 发布药品，选择合法日期，提交成功。
2. 发布药品，不填日期，确认前端阻止。
3. 发布耗材，勾选长期有效，提交成功。
4. 编辑一个已有物品，确认日期正确回填。
5. 测试 2 月日期边界和闰年。

---

## Task Package

**Task ID**: `TASK-NANE-CONTACT-010`  
**Title**: 修复联系方式重复查看重复扣减额度  
**Priority**: P2  
**Estimated Scope**: 中（50-200 行）

---

### Context

当前 `POST /api/items/:id/contact` 每次调用都会向 `contact_views` 插入记录并扣减每日额度。测试反馈指出：用户已查看过某个物品联系方式后，再次点击同一按钮、关闭详情再重新打开同一物品，不应重复消耗额度。

相关文件：

- `server/index.js` — `viewContact()`、`DAILY_CONTACT_LIMIT`、`contact_views` 写入逻辑
- `server/schema.sql` — `contact_views` 表结构，如需加唯一约束或索引
- `server/db.js` — 启动迁移，如需新增索引/约束
- `web/app.js` — `viewContact()`、`openDetail()`、联系方式展示状态
- `web/index.html` — 详情 dialog 无需大改
- `docs/test-guide.md` — 联系方式额度验收
- `docs/development-log.md` — 开发日志

---

### Requirements

1. 后端 `POST /api/items/:id/contact` 改为幂等：
   - 同一用户同一天对同一物品已经查看过联系方式时，不再新增 `contact_views` 记录。
   - 不再扣减今日剩余额度。
   - 仍返回联系方式。
2. 第一次查看某物品时，才插入 `contact_views` 并扣减额度。
3. 每日额度含义改为“每天最多查看 5 个不同物品的联系方式”，而不是“点击 5 次”。
4. 如果用户当天已查看过该物品，即使额度已用完，也允许再次查看该物品联系方式。
5. 如果用户当天额度已用完且该物品之前没查看过，则返回 429。
6. 后端返回字段中增加一个布尔值，例如：
   - `alreadyViewed: true/false`
   - `countedThisTime: true/false`
   供前端展示更准确的提示。
7. 前端在同一个详情弹窗内，第一次查看成功后，再次点击按钮不应再次调用接口；可直接展示已获取的联系方式，或按钮变为已查看状态。
8. 关闭详情再重新打开同一物品时，前端可以再次调用接口，但后端必须不重复扣减。
9. 前端文案调整：
   - 首次计数：`今日剩余查看次数：X`
   - 已查看过：`你今天已查看过该物品联系方式，本次不重复消耗额度。`
10. 如有必要，为 `contact_views` 增加唯一约束或唯一索引：`viewer_id + item_id + view_date`。
11. 启动迁移必须兼容已有数据；如果已有重复数据导致唯一索引创建失败，需要先去重或使用不破坏旧数据的方案。
12. 更新测试文档与开发日志。

---

### Constraints

- 不要取消每日额度限制。
- 不要让未登录/未补全资料用户查看联系方式。
- 不要公开宿舍号。
- 不要改变发布者查看自己物品详情的逻辑；发布者自己的发布不应走 `/contact`。
- 不要把联系方式缓存到 localStorage，避免隐私残留。

---

### Acceptance Criteria

- [ ] AC-1：同一用户第一次查看某物品联系方式时，扣减一次额度。
- [ ] AC-2：同一用户同一天再次查看同一物品，不再扣减额度。
- [ ] AC-3：关闭详情再重新进入同一物品，不再扣减额度。
- [ ] AC-4：用户当天已查看过该物品时，即使额度已用完，也能再次查看该物品联系方式。
- [ ] AC-5：用户当天额度已用完且查看新物品时，仍返回 429。
- [ ] AC-6：前端能显示“本次不重复消耗额度”或同等清晰文案。
- [ ] AC-7：`contact_views` 不再无限插入同一用户同一天同一物品的重复记录。
- [ ] AC-8：`node --check server/index.js`、`node --check server/db.js`、`node --check web/app.js` 通过。

---

### Test Expectations

```bash
node --check server/index.js
node --check server/db.js
node --check web/app.js
```

手动回归：

1. B 登录并补全资料。
2. B 查看物品 A 的联系方式，记录剩余额度。
3. B 在同一详情中再次点击查看，确认额度不变。
4. B 关闭详情，重新打开物品 A，再查看联系方式，确认额度不变。
5. B 查看不同物品直到额度用完。
6. B 再次查看已看过的物品 A，确认允许查看。
7. B 查看未看过的新物品，确认返回额度用完。
