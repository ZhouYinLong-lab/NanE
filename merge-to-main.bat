@echo off
cd /d D:\Projects\NanE
echo === 切换到 main ===
git checkout main
echo === 合并 dev 到 main ===
git merge dev --no-ff -m "chore: sync main with dev — EL contest milestone"
echo === 推送 main ===
git push origin main
echo === 切回 dev ===
git checkout dev
echo.
echo === 完成！最新提交记录 ===
git log --oneline -6
pause
