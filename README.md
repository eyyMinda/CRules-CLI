# Cursor Rules Sync

A global CLI tool to sync `.cursor` rules and commands from a centralized GitHub repository to any Shopify theme project.

## Setup

### 1. Install globally

From this directory, run:

```bash
npm install -g .
```

Or if you prefer to install from the GitHub repo directly:

```bash
npm install -g git+https://github.com/eyyMinda/Cursor-Rules.git
```

### 2. Use in any project

Navigate to any Shopify theme project and run:

```bash
cursor-sync
```

This will:

- Clone/update the Cursor Rules repository to `~/.cursor-rules-cache`
- Copy the `.cursor` folder to your current project
- Preserve any project-specific files (files starting with `project-`)

## Project-Specific Files

Files starting with `project-` in `.cursor/rules/` or `.cursor/commands/` will be preserved during sync. For example:

- `project-7879-specific.mdc` ✅ Preserved
- `project-store-xyz.mdc` ✅ Preserved
- `shopify-reusable-snippets.mdc` ❌ Synced from repo

## Updating Rules

1. Make changes to your GitHub repo: `https://github.com/eyyMinda/Cursor-Rules.git`
2. Run `cursor-sync` in any project to get the latest changes

## Manual Setup (Alternative)

If you prefer not to use npm, you can create a simple script:

### Windows (PowerShell)

Create `cursor-sync.ps1` in a directory in your PATH:

```powershell
# cursor-sync.ps1
$repoUrl = "https://github.com/eyyMinda/Cursor-Rules.git"
$cacheDir = "$env:USERPROFILE\.cursor-rules-cache"
$currentDir = Get-Location

if (-not (Test-Path $cacheDir)) {
    git clone $repoUrl $cacheDir
} else {
    Push-Location $cacheDir
    git pull
    Pop-Location
}

# Backup project-specific files
$projectFiles = @()
if (Test-Path ".cursor\rules") {
    $projectFiles += Get-ChildItem ".cursor\rules\project-*" -ErrorAction SilentlyContinue
}
if (Test-Path ".cursor\commands") {
    $projectFiles += Get-ChildItem ".cursor\commands\project-*" -ErrorAction SilentlyContinue
}

# Copy .cursor folder
Copy-Item "$cacheDir\.cursor" -Destination ".cursor" -Recurse -Force

# Restore project-specific files
foreach ($file in $projectFiles) {
    Copy-Item $file.FullName -Destination ".cursor\$($file.Directory.Name)\$($file.Name)" -Force
}

Write-Host "✅ Cursor Rules synced!"
```

### Linux/Mac (Bash)

Create `cursor-sync.sh` in a directory in your PATH:

```bash
#!/bin/bash
# cursor-sync.sh

REPO_URL="https://github.com/eyyMinda/Cursor-Rules.git"
CACHE_DIR="$HOME/.cursor-rules-cache"
CURRENT_DIR=$(pwd)

if [ ! -d "$CACHE_DIR" ]; then
    git clone "$REPO_URL" "$CACHE_DIR"
else
    cd "$CACHE_DIR" && git pull && cd "$CURRENT_DIR"
fi

# Backup project-specific files
mkdir -p .cursor/rules .cursor/commands
PROJECT_FILES=$(find .cursor -name "project-*" 2>/dev/null || true)

# Copy .cursor folder
cp -r "$CACHE_DIR/.cursor"/* .cursor/

# Restore project-specific files
if [ -n "$PROJECT_FILES" ]; then
    echo "$PROJECT_FILES" | while read -r file; do
        cp "$file" ".cursor/$(basename $(dirname $file))/$(basename $file)"
    done
fi

echo "✅ Cursor Rules synced!"
```

Make it executable:

```bash
chmod +x cursor-sync.sh
```
