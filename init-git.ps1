# Helper script to initialize git for KitStash deployment
# Run this in PowerShell from the kit-stash folder:
#   .\init-git.ps1

Write-Host "=== KitStash Git Initialization Helper ===" -ForegroundColor Cyan

# Check if git is available
try {
    git --version | Out-Null
} catch {
    Write-Host "ERROR: 'git' command not found." -ForegroundColor Red
    Write-Host "Please install Git for Windows from https://git-scm.com/download/win and restart PowerShell." -ForegroundColor Yellow
    exit 1
}

if (Test-Path .git) {
    Write-Host ".git already exists. Current status:" -ForegroundColor Yellow
    git status --short
} else {
    Write-Host "Initializing new git repository..." -ForegroundColor Green
    git init
}

Write-Host ""
Write-Host "Adding files..." -ForegroundColor Green
git add .

Write-Host ""
Write-Host "Creating initial commit (if changes exist)..." -ForegroundColor Green

# Use PowerShell-compatible error handling (works on Windows PowerShell 5.1+)
$commitResult = git commit -m "chore: prepare for Vercel deploy - centralized SUPABASE_USER_ID, cleaned dev hacks, added vercel.json + DEPLOY.md" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "(Nothing new to commit or first commit done)" -ForegroundColor Yellow
} else {
    Write-Host "Commit created successfully." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Next steps (copy/paste) ===" -ForegroundColor Cyan
Write-Host "1. Create a new repo on GitHub (https://github.com/new) - name it 'kit-stash' or similar."
Write-Host "   DO NOT initialize it with README, .gitignore, or license."
Write-Host ""
Write-Host "2. Then run these commands (replace YOUR_USERNAME):"
Write-Host '   git remote add origin https://github.com/YOUR_USERNAME/kit-stash.git' -ForegroundColor White
Write-Host '   git branch -M main' -ForegroundColor White
Write-Host '   git push -u origin main' -ForegroundColor White
Write-Host ""
Write-Host "3. Go to https://vercel.com/new and import the repo."
Write-Host "4. See DEPLOY.md for the full environment variable list and password protection steps."
Write-Host ""
Write-Host 'Done. Your local dev (npm run dev) is unaffected.' -ForegroundColor Green