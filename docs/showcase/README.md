# NanE Showcase

展示包包含两类材料：

- `screens/`：真实页面截图式效果图，覆盖首页筛选、发布页、我的页履约评价、桌面首页。
- `poster/`：答辩展示长图，用于说明评委意见回应、分类体系、履约评价 MVP 和演示路径。

重新生成截图：

```powershell
powershell -ExecutionPolicy Bypass -File docs\showcase\capture-screenshots.ps1
```

生成展示长图 PNG：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1600,2200 --screenshot=docs\showcase\poster\nane-pitch-poster.png docs\showcase\poster\nane-pitch-poster.html
```
