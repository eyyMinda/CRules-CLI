# Cursor Rules Sync - PowerShell Script
# Usage: .\cursor-sync.ps1 or add to PATH for global access

$repoUrl = "https://github.com/eyyMinda/Cursor-Rules.git"
$cacheDir = "$env:USERPROFILE\.cursor-rules-cache"
$currentDir = Get-Location

Write-Host "🚀 Syncing Cursor Rules...`n" -ForegroundColor Cyan

# Clone or update repo
if (-not (Test-Path $cacheDir)) {
    Write-Host "📦 Cloning Cursor Rules repository..." -ForegroundColor Yellow
    git clone $repoUrl $cacheDir
} else {
    Write-Host "🔄 Updating Cursor Rules repository..." -ForegroundColor Yellow
    Push-Location $cacheDir
    git pull
    Pop-Location
}

# Backup project-specific files
$backup = @{}
if (Test-Path ".cursor\rules") {
    Get-ChildItem ".cursor\rules\project-*" -ErrorAction SilentlyContinue | ForEach-Object {
        $backup["rules\$($_.Name)"] = Get-Content $_.FullName -Raw
    }
}
if (Test-Path ".cursor\commands") {
    Get-ChildItem ".cursor\commands\project-*" -ErrorAction SilentlyContinue | ForEach-Object {
        $backup["commands\$($_.Name)"] = Get-Content $_.FullName -Raw
    }
}

# Ensure .cursor directory exists
if (-not (Test-Path ".cursor")) {
    New-Item -ItemType Directory -Path ".cursor" | Out-Null
}

# Copy .cursor folder from cache (excluding project-specific files)
Write-Host "📋 Copying rules and commands..." -ForegroundColor Yellow

if (Test-Path "$cacheDir\.cursor\rules") {
    New-Item -ItemType Directory -Path ".cursor\rules" -Force | Out-Null
    Get-ChildItem "$cacheDir\.cursor\rules" -File | Where-Object { $_.Name -notlike "project-*" } | ForEach-Object {
        Copy-Item $_.FullName -Destination ".cursor\rules\$($_.Name)" -Force
    }
}

if (Test-Path "$cacheDir\.cursor\commands") {
    New-Item -ItemType Directory -Path ".cursor\commands" -Force | Out-Null
    Get-ChildItem "$cacheDir\.cursor\commands" -File | Where-Object { $_.Name -notlike "project-*" } | ForEach-Object {
        Copy-Item $_.FullName -Destination ".cursor\commands\$($_.Name)" -Force
    }
}

# Restore project-specific files
if ($backup.Count -gt 0) {
    Write-Host "💾 Restoring project-specific files..." -ForegroundColor Yellow
    foreach ($filePath in $backup.Keys) {
        $fullPath = ".cursor\$filePath"
        $dir = Split-Path $fullPath -Parent
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        Set-Content -Path $fullPath -Value $backup[$filePath] -NoNewline
    }
}

Write-Host "`n✅ Cursor Rules synced successfully!" -ForegroundColor Green
Write-Host "📁 Location: $currentDir\.cursor" -ForegroundColor Gray

if ($backup.Count -gt 0) {
    Write-Host "`n💡 Preserved $($backup.Count) project-specific file(s)" -ForegroundColor Cyan
}
