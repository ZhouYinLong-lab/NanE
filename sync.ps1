# NanE 仓库整理 & 同步脚本
# 用法：在 D:\Projects\NanE 目录下执行  .\sync.ps1
Set-Location $PSScriptRoot

Write-Host "`n=== 1. 暂存本地改动 ===" -ForegroundColor Cyan
git stash

Write-Host "`n=== 2. 拉取远端提交（fast-forward）===" -ForegroundColor Cyan
git pull --ff-only

Write-Host "`n=== 3. 恢复暂存 ===" -ForegroundColor Cyan
git stash pop

Write-Host "`n=== 4. 写入 .gitattributes（永久修复 CRLF 问题）===" -ForegroundColor Cyan
@"
# 统一使用 LF，防止 CRLF 污染 diff
* text=auto
*.js   text eol=lf
*.css  text eol=lf
*.html text eol=lf
*.md   text eol=lf
*.json text eol=lf
*.sql  text eol=lf
*.wxss text eol=lf
*.wxml text eol=lf
"@ | Set-Content -NoNewline .gitattributes

Write-Host "`n=== 5. 取消追踪调试快照文件 ===" -ForegroundColor Cyan
$filesToUntrack = @(
    "dialog-open.txt","login-check.json","login-snap.txt",
    "login-new-snap.txt","settings-snap.txt","snap-390.txt",
    ".claude/ralph-loop.local.md"
)
foreach ($f in $filesToUntrack) {
    if (git ls-files --error-unmatch $f 2>$null) {
        git rm --cached $f
    }
}

Write-Host "`n=== 6. 重新规范化所有已追踪文件的行尾 ===" -ForegroundColor Cyan
git add --renormalize .

Write-Host "`n=== 7. 暂存实质性变更 ===" -ForegroundColor Cyan
git add .gitattributes
git add .gitignore
git add README.md
git add CHANGELOG.md
git add "docs/contest-materials/项目书.md"
git add docs/full-chain-demo-script.md
git add desktop/ 2>$null

Write-Host "`n=== 8. 提交 ===" -ForegroundColor Cyan
git commit -m "docs: rewrite 项目书 for EL contest; add full-chain-demo-script, .gitattributes; update gitignore"

Write-Host "`n=== 9. 推送 ===" -ForegroundColor Cyan
git push origin dev

Write-Host "`n=== 完成 ===" -ForegroundColor Green
git log --oneline -5
git status --short
