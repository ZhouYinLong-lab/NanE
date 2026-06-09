# Claude Code Change Request: UI Polish 012 CR1

## Task Package

**Task ID**: `TASK-NANE-UI-012-CR1`  
**Title**: 修正我的发布列表始终缺少红色删除按钮的问题  
**Depends on**: `TASK-NANE-UI-012`（已完成）  
**Priority**: P1  
**Estimated Scope**: 中（50-200 行）

---

### Context

用户验收后反馈：“我的发布依然只有编辑没有红色的删除按钮”。上一轮实现中，`web/app.js` 的 `renderItem()` 只在 `item.status === "online" || item.status === "reviewing"` 时渲染红色“下架”按钮：

```js
${item.status === "online" || item.status === "reviewing"
  ? `<button type="button" class="danger small" data-owner-action="take-down" ...>下架</button>`
  : ""}
```

这会导致已驳回、已下架、已领取、过期等状态的“我的发布”卡片只显示“编辑”，没有红色操作按钮。用户现在明确要求：我的发布列表中不能只有编辑，还要有红色“删除”按钮。

相关文件：
- `web/app.js` — `renderItem()`、`loadMyItems()`、`handleListTakeDown()`、`myItemList` 点击事件
- `web/styles.css` — `.danger`、`.owner-actions` 样式
- `server/index.js` — 现有 `/api/me/items/:id/take-down` 接口；如需新增删除接口，在这里实现
- `docs/development-log.md` — 记录本轮修正

---

### Requirements

1. **我的发布列表必须始终显示红色删除类按钮**
   - 在 `renderItem(item, { showOwnerActions: true })` 的情况下，每条本人发布记录都必须显示：
     - “编辑”按钮
     - 红色“删除”按钮
   - 不要再只对 `online/reviewing` 状态显示红色按钮。
   - 红色按钮文字统一为“删除”，不要让用户看到只有“编辑”的卡片。

2. **删除按钮语义按状态处理**
   - 对 `online` / `reviewing` 状态：
     - 点击“删除”应调用现有 `/api/me/items/:id/take-down`，效果等同下架。
     - 成功提示建议为“已删除/下架，首页将不再展示”。
   - 对 `rejected` / `taken_down` / `claimed` / `expired` 等已经不会在首页展示的状态：
     - 点击“删除”应至少从“我的发布”列表中移除该记录，避免用户继续看到。
     - 推荐实现一个真正的用户侧删除/隐藏能力：
       - 新增字段如 `owner_hidden BOOLEAN NOT NULL DEFAULT false`，或新增接口将用户侧记录标记为隐藏。
       - `/api/me/items` 默认不返回 `owner_hidden = true` 的记录。
       - 删除动作不要物理删除数据库记录，避免破坏审核日志、领取记录、后台追溯。
   - 如果为了最小改动选择复用 `taken_down` 状态，也必须确保所有状态下点击红色按钮都有明确反馈，且列表刷新后不再只剩“编辑”。

3. **后端接口要求**
   - 如果新增用户侧隐藏接口，建议：
     - `POST /api/me/items/:id/delete`
     - 只允许物品发布者本人操作。
     - 对 `online` / `reviewing` 可将状态改为 `taken_down` 并隐藏，或先下架再隐藏。
     - 对其他状态直接标记隐藏。
   - 不要允许用户删除或隐藏别人的物品。
   - 不要物理删除 `items` 行。

4. **前端交互要求**
   - 红色按钮使用现有 `.danger` 样式。
   - 点击“删除”必须 `event.stopPropagation()`，不能打开详情弹窗。
   - 点击后按钮变为禁用状态，例如“删除中...”。
   - 成功后刷新“我的发布”列表，并可刷新首页。
   - 失败时恢复按钮状态并显示错误。

5. **详情弹窗一致性**
   - 发布者详情弹窗中也应保持可用的红色删除/下架入口。
   - 详情弹窗里的危险操作也应使用 `.danger` 样式，而不是普通黑色 secondary。

6. **文案**
   - 列表按钮显示“删除”。
   - 确认弹窗文案：
     - `确定要删除这条发布记录吗？上架中或审核中的物品会同时下架。`
   - 成功文案：
     - `发布记录已删除。`

---

### Constraints

- 不要物理删除数据库中的 `items`、`review_logs`、`claim_requests`。
- 不要影响管理后台查看历史记录和审核记录。
- 不要影响首页只展示 `online` 物品的逻辑。
- 不要修改联系方式查看额度逻辑。
- 不要提交 `.claude/` 或本地配置文件。

---

### Acceptance Criteria

- [ ] AC-1：在“我的发布”列表中，所有状态的本人发布记录都显示“编辑”和红色“删除”按钮。
- [ ] AC-2：`online` / `reviewing` 记录点击“删除”后，物品不再出现在首页。
- [ ] AC-3：`rejected` / `taken_down` / `claimed` / `expired` 记录点击“删除”后，不再出现在“我的发布”列表。
- [ ] AC-4：点击红色“删除”按钮不会打开详情弹窗。
- [ ] AC-5：删除失败时按钮恢复，用户能看到错误提示。
- [ ] AC-6：详情弹窗中的危险操作也使用红色按钮样式。
- [ ] AC-7：管理员后台仍能看到原始记录或至少不因用户侧删除破坏审核/领取追溯。
- [ ] AC-8：`node --check server/index.js` 和 `node --check web/app.js` 通过。

---

### Test Expectations

请运行：

```bash
node --check server/index.js
node --check web/app.js
git diff --check
```

手动验收建议：

1. 登录一个有多条发布记录的账号。
2. 确认审核中、上架中、已驳回、已下架等卡片都显示“编辑”和红色“删除”。
3. 点击上架中物品的“删除”，确认首页不再展示。
4. 点击已驳回或已下架物品的“删除”，确认我的发布列表中消失。
5. 确认点击删除不会打开详情弹窗。

---

### Completion Report Required

Claude Code 完成后请按以下格式回复：

```markdown
## Completion Report

**Task ID**: `TASK-NANE-UI-012-CR1`
**Status**: ✅ DONE / ⚠️ PARTIAL / ❌ BLOCKED

### Summary

### Files Modified

### Acceptance Criteria Status

### Test Results

### Deviations

### Open Questions
```
