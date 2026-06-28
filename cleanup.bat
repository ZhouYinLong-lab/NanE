@echo off
cd /d D:\Projects\NanE

echo === 1. 取消追踪根目录截图 / 调试文件 ===
git rm --cached --ignore-unmatch ^
  desktop-check.png desktop-discover.png dialog-mobile.png ^
  iter1-detail-dialog.png iter1-home-initial.png iter1-mine-login.png iter1-publish-guest.png ^
  login-check.png login-current.png login-form-check.png login-initial.png ^
  login-new.png login-secondary-button.png login-stacked-check.png ^
  login-check.json login-new-snap.txt login-snap.txt dialog-open.txt ^
  settings-snap.txt snap-390.txt

echo === 2. 取消追踪内部文档 ===
git rm --cached --ignore-unmatch docs/next-session-prompt.md

echo === 3. 取消追踪 desktop 二进制产物 ===
git rm --cached --ignore-unmatch desktop/dist/NanE.exe
git rm --cached --ignore-unmatch "desktop/dist/NanE 桌面版.lnk"
git rm --cached --ignore-unmatch desktop/dist/NanE.url
git rm --cached --ignore-unmatch desktop/dist/nane.ico
git rm --cached --ignore-unmatch desktop/build/nane-local-code-signing.cer
git rm --cached --ignore-unmatch desktop/build/self-test.log

echo === 4. 取消追踪临时脚本 ===
git rm --cached --ignore-unmatch merge-to-main.bat sync.ps1 cleanup.bat

echo === 5. 更新 .gitignore ===
echo. >> .gitignore
echo # Root-level debug screenshots >> .gitignore
echo desktop-*.png >> .gitignore
echo dialog-mobile.png >> .gitignore
echo iter1-*.png >> .gitignore
echo login-*.png >> .gitignore
echo. >> .gitignore
echo # Temporary helper scripts >> .gitignore
echo *.bat >> .gitignore
echo sync.ps1 >> .gitignore
echo cleanup.bat >> .gitignore
echo. >> .gitignore
echo # Desktop build output >> .gitignore
echo desktop/dist/ >> .gitignore
echo desktop/build/self-test.log >> .gitignore
echo. >> .gitignore
echo # Internal session files >> .gitignore
echo docs/next-session-prompt.md >> .gitignore

echo === 6. 暂存并提交 ===
git add .gitignore
git commit -m "chore: remove debug screenshots, desktop binaries, internal session files from tracking"

echo === 7. 推送 dev ===
git push origin dev

echo === 8. 同步 main（推送 dev 到远端 main）===
git push origin dev:main --force-with-lease

echo.
echo === 完成！当前状态 ===
git log --oneline -5
git status --short
pause
