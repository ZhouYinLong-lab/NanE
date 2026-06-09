# Claude Code Task Package: UI Polish 012

## Task Package

**Task ID**: `TASK-NANE-UI-012`  
**Title**: 统一网页描边、调整设置顺序、修复深色导航、我的发布增加红色下架按钮  
**Priority**: P1  
**Estimated Scope**: 中（50-200 行）

---

### Context

NanE 网页端当前已有发现、发布、我的、设置四个主视图。用户在移动端验收时发现四个问题：搜索框描边颜色与其他控件不统一；设置页中“外观”应放到倒数第二个；切换深色模式后顶部 tab 导航仍保持浅色；“我的发布”卡片列表应直接提供“下架”红色按钮，而不只是在详情弹窗里提供下架。

相关文件：
- `web/index.html` — 页面结构、顶部主导航、设置页区块、我的发布入口
- `web/styles.css` — 颜色变量、搜索框、tab 导航、深色模式、按钮样式
- `web/app.js` — 视图切换、我的发布列表渲染、下架逻辑、事件绑定

---

### Requirements

1. **统一搜索框和控件描边颜色**
   - 当前用户观察到搜索框描边是 `#e0d8c7`，其他控件接近 `#e8eae0`。
   - 将网页端输入框、搜索框、卡片、chips、tabs 等常规描边统一到同一套变量。
   - 建议在 `web/styles.css` 的 `:root` 中统一 `--line` 为 `#e0d8c7` 或项目现有主控件描边色，并确保 `.search-row input` 不再硬编码另一种描边。
   - 保持南大紫 `#6E0065` 的 active / focus 强调不变。

2. **设置页区块顺序调整**
   - 在 `web/index.html` 中调整 `view-settings` 内部区块顺序。
   - “外观”区块不要放在设置页最上方。
   - 新顺序应为：
     1. 账号
     2. 通知
     3. 外观
     4. 关于 NanE
   - 不改变顶部主导航仍为：发现、发布、我的、设置。

3. **深色模式下顶部主导航同步变暗**
   - 切换深色模式后，顶部 `.tabs` 胶囊背景、边框、未选中 tab 文本色、active tab 均应适配深色。
   - 不要继续使用固定的浅色 `rgba(255, 250, 242, 0.88)` 作为深色模式导航背景。
   - 深色模式下 active “设置”仍使用南大紫，未选中项应清晰但不刺眼。
   - 参考用户截图：当前问题是上方导航栏仍是浅色，非常突兀。

4. **我的发布列表卡片增加“下架”红色按钮**
   - 当前 `loadMyItems()` 使用 `renderItem(item, { showRoom: true, showStatus: true, showClaims: true })` 渲染自己的发布记录。
   - 修改“我的发布”列表渲染，使每条自己的发布记录直接显示操作区：
     - “编辑”按钮
     - 当状态为 `online` 或 `reviewing` 时显示“下架”按钮
   - “下架”按钮必须使用红色危险样式，例如 `#b3261e` 或项目协调的深红色，不能沿用普通 secondary 黑色按钮。
   - 点击列表卡片上的“下架”应调用现有 `/me/items/:id/take-down` 逻辑或复用 `takeDownMyItem()` 的核心请求逻辑。
   - 下架成功后刷新“我的发布”列表，并给出明确反馈。
   - 不要让点击“下架”按钮同时触发打开详情弹窗。

5. **保持已有详情弹窗能力**
   - `openMyItemDetail()` 里的编辑和下架能力可以保留。
   - 如果提取公共函数，请确保详情弹窗下架和列表下架都能工作。

---

### Constraints

- 本任务只修改网页端，不修改小程序端。
- 不修改后端 API、数据库 schema、部署配置。
- 不改变用户认证、查看联系方式额度、领取提醒、发布审核等业务规则。
- 不删除现有深色模式功能，只修正视觉适配。
- 不提交 `.claude/` 或任何本地配置目录。

---

### Acceptance Criteria

- [ ] AC-1：搜索框与其他常规控件描边颜色统一，不再出现 `#e0d8c7` 与 `#e8eae0` 混用造成的视觉差异。
- [ ] AC-2：设置页区块顺序为“账号 → 通知 → 外观 → 关于 NanE”。
- [ ] AC-3：深色模式下顶部 `.tabs` 导航背景和边框为深色体系，未选中 tab 不再显示在浅色胶囊上。
- [ ] AC-4：“我的发布”列表中每条本人发布记录直接显示“编辑”按钮。
- [ ] AC-5：状态为 `online` 或 `reviewing` 的本人发布记录在列表中直接显示红色“下架”按钮。
- [ ] AC-6：点击列表“下架”按钮会调用下架接口、成功后刷新我的发布列表，并且不会误触发打开详情。
- [ ] AC-7：详情弹窗中的原有编辑/下架功能仍可用。
- [ ] AC-8：移动端 375px 宽度下按钮不竖排、不溢出；深色模式截图中顶部导航与页面背景协调。

---

### Test Expectations

请运行：

```bash
node --check web/app.js
git diff --check
```

手动验收建议：

1. 打开 `https://nane.zylatent.com` 或本地网页端。
2. 在浅色模式下观察搜索框、chips、卡片、tabs 描边是否统一。
3. 进入设置页，确认区块顺序为账号、通知、外观、关于。
4. 开启深色模式，确认顶部 tab 导航随深色模式切换。
5. 登录后进入“我的发布”，确认本人发布记录列表直接出现编辑按钮；可下架状态出现红色下架按钮。
6. 点击红色下架按钮，确认不会打开详情弹窗，且成功后列表刷新。

---

### Completion Report Required

Claude Code 完成后请按以下格式回复：

```markdown
## Completion Report

**Task ID**: `TASK-NANE-UI-012`
**Status**: ✅ DONE / ⚠️ PARTIAL / ❌ BLOCKED

### Summary

### Files Modified

### Acceptance Criteria Status

### Test Results

### Deviations

### Open Questions
```
