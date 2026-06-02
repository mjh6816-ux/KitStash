# commit-ready.ps1
# Run this to prepare a clean commit for the recent deployment / PWA / reports / icons work.
# It will stage the important changed files, show you a status/diff summary,
# and suggest a good commit message. Review before actually committing.

Write-Host "=== KitStash Commit Preparation ===" -ForegroundColor Cyan
Write-Host "This will stage production/deployment-related changes (PWA icons, reports valuation export, mobile FAB, docs, vercel config, etc.)." -ForegroundColor Yellow
Write-Host "It deliberately skips .env.local, build artifacts, and node_modules." -ForegroundColor Yellow
Write-Host ""

# Make sure we're in the right place
if (-not (Test-Path package.json)) {
    Write-Host "ERROR: Not in the kit-stash root. cd to the folder first." -ForegroundColor Red
    exit 1
}

# Stage the key areas
Write-Host "Staging files..." -ForegroundColor Green
git add app/ public/manifest.json public/icons/*.png public/icons/*.jpg vercel.json
git add DEPLOY.md ICONS.md README.md init-git.ps1 commit-ready.ps1
git add .env.example SUPABASE_MIGRATIONS.sql add-*.sql
git add build-check.txt quick-check.ps1   # optional build logs, harmless

# Show what will be committed
Write-Host ""
Write-Host "=== Files staged (git status --short) ===" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "=== Summary of changes (git diff --stat) ===" -ForegroundColor Cyan
git diff --cached --stat

Write-Host ""
Write-Host "=== Suggested commit message ===" -ForegroundColor Green
Write-Host 'feat: complete deployment + PWA + reports polish' -ForegroundColor White
Write-Host ''
Write-Host ' - Race-car themed PWA icons (transparent v2 + apple-touch-icon.png)'
Write-Host ' - Valuation research export in Reports (easy text/CSV for MSRP/current value lookup with Grok)'
Write-Host ' - Mobile FAB +Add button in inventory'
Write-Host ' - Per-section CSV exports in reports'
Write-Host ' - Production-ready config (Vercel, env vars, manifest, docs)'
Write-Host ' - Cleanup of old icons, unused proxy.ts, updated guides'
Write-Host ''
Write-Host 'Deployment now works well remotely. Icons and reports ready for real use.'

Write-Host ""
Write-Host "=== Next steps ===" -ForegroundColor Yellow
Write-Host "1. Review the status and diff above carefully."
Write-Host "2. (Optional but recommended) Fix remote casing if needed:"
Write-Host "   git remote set-url origin https://github.com/mjh6816-ux/KitStash.git" -ForegroundColor White
Write-Host "3. If everything looks good, run:"
Write-Host "   git commit -m 'feat: complete deployment + PWA + reports polish'" -ForegroundColor White
Write-Host "   (or edit the message)"
Write-Host "4. Then: git push"
Write-Host ""
Write-Host "If you want to unstage something: git restore --staged <file>"
Write-Host "If you want a different message or to split the commit (e.g. icons separate from reports), let me know." -ForegroundColor Cyan

Write-Host ""
Write-Host "Script finished. Review before committing!" -ForegroundColor Green