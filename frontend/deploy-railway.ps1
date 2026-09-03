# Loop GPT Frontend - Railway Deployment Script
# Run this in PowerShell from the frontend directory

param(
    [string]$RailwayToken = "",
    [string]$BackendUrl = "http://194.15.36.172:3001"
)

Write-Host "=========================================="
Write-Host "  Loop GPT Frontend - Railway Deploy"
Write-Host "=========================================="
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "ERROR: Please run this script from the frontend directory"
    Write-Host "  cd C:\Users\chris\projects\development\Loop_GPT_original\frontend"
    exit 1
}

# Update .env.local with backend URL
Write-Host "Updating .env.local with backend URL: $BackendUrl"
$envContent = @"
# Backend API base URL
NEXT_PUBLIC_API_URL=$BackendUrl

# Analytics / error monitoring (optional)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=
"@
$envContent | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline

# Check if git is initialized
if (!(Test-Path ".git")) {
    Write-Host "Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Loop GPT Frontend"
}

# Check for GitHub remote
$remoteUrl = git remote get-url origin 2>$null
if ([string]::IsNullOrEmpty($remoteUrl)) {
    Write-Host ""
    Write-Host "No GitHub remote configured. Please:"
    Write-Host "  1. Create a new repo on GitHub"
    Write-Host "  2. Run: git remote add origin https://github.com/YOUR_USERNAME/loop-gpt-frontend.git"
    Write-Host "  3. Run: git push -u origin main"
    Write-Host ""
} else {
    Write-Host "GitHub remote: $remoteUrl"
    
    # Push to GitHub
    Write-Host "Pushing to GitHub..."
    git add .
    git commit -m "Update for deployment" --allow-empty
    git push origin main 2>&1
}

Write-Host ""
Write-Host "=========================================="
Write-Host "  Next Steps for Railway Deployment"
Write-Host "=========================================="
Write-Host ""
Write-Host "1. Go to https://railway.app"
Write-Host "2. Click 'New Project' → 'Deploy from GitHub repo'"
Write-Host "3. Select your 'loop-gpt-frontend' repository"
Write-Host "4. Add environment variable:"
Write-Host "   NEXT_PUBLIC_API_URL = $BackendUrl"
Write-Host "5. Click 'Deploy'"
Write-Host ""
Write-Host "After deployment, update your backend's FRONTEND_URL"
Write-Host "in the VPS .env file to match your Railway domain."
Write-Host ""