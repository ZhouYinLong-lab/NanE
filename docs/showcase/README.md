# NanE Showcase

展示包包含两类材料：

- `screens/`：真实页面截图式效果图，覆盖首页筛选、发布页、我的页履约评价、桌面首页。
- `poster/`：展示海报。`nane-final-slide.png` 为 16:9 PPT 比例最终展示图；`nane-pitch-poster.png` 为纵向答辩长图。

重新生成截图：

```powershell
powershell -ExecutionPolicy Bypass -File docs\showcase\capture-screenshots.ps1
```

生成展示长图 PNG：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1600,2200 --screenshot=docs\showcase\poster\nane-pitch-poster.png docs\showcase\poster\nane-pitch-poster.html
```

生成 16:9 PPT 展示图：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1080 --screenshot=docs\showcase\poster\nane-final-slide.png docs\showcase\poster\nane-final-slide.html
```
