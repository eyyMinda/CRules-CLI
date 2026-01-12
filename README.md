# Cursor Rules Sync

A global CLI tool to sync `.cursor` rules and commands from a centralized GitHub repository to any Shopify theme project.

## 🚀 Features

- **Sync** rules from repo to any project
- **Push** local changes back to the repository
- **Status** check to see what's different
- **Diff** view for individual files
- **Auto-preserve** project-specific files (files starting with `project-`)

## 📦 Setup

### Install globally

From this directory, run:

```bash
npm install -g .
```

Or install from GitHub directly:

```bash
npm install -g git+https://github.com/eyyMinda/Cursor-Rules.git
```

## 🎯 Commands

### `cursor-sync`

Sync rules from the repository to your current project.

```bash
cursor-sync
```

**What it does:**

- Updates the cached repository
- Copies `.cursor` folder to your project
- Preserves project-specific files (files starting with `project-`)

### `cursor-push` ⭐

Push your local changes back to the repository.

```bash
cursor-push
```

**What it does:**

- Shows what files were added/modified/deleted
- Optionally shows detailed diff
- Prompts for confirmation
- Commits and pushes changes to GitHub

**Example workflow:**

1. Make changes to rules in your project
2. Run `cursor-push` to review changes
3. Confirm to push updates to the repo
4. Other projects can now `cursor-sync` to get your updates

### `cursor-status`

Check what's different between your project and the repository.

```bash
cursor-status
```

**What it shows:**

- New files (not in repo)
- Modified files (different from repo)
- Deleted files (in repo but not in project)
- Synced files count

### `cursor-diff`

View detailed diff for a specific file.

```bash
cursor-diff <file-path>
```

**Example:**

```bash
cursor-diff rules/shopify-reusable-snippets.mdc
```

## 📁 Project-Specific Files

Files starting with `project-` in `.cursor/rules/` or `.cursor/commands/` will be **preserved** during sync and **ignored** during push. For example:

- `project-7879-specific.mdc` ✅ Preserved (project-specific)
- `project-store-xyz.mdc` ✅ Preserved (project-specific)
- `shopify-reusable-snippets.mdc` ❌ Synced from repo (shared)

## 🔄 Typical Workflow

### Working on rules in a project:

```bash
# 1. Make changes to rules in your project
# Edit .cursor/rules/some-rule.mdc

# 2. Check what changed
cursor-status

# 3. Review detailed diff (optional)
cursor-diff rules/some-rule.mdc

# 4. Push changes to repository
cursor-push
```

### Getting latest rules in a project:

```bash
# Just sync from repo
cursor-sync
```

## 💡 Best Practices

1. **Always check status before pushing**: Run `cursor-status` first
2. **Review diffs**: Use `cursor-diff` to see exactly what changed
3. **Commit often**: Push changes regularly so other projects stay updated
4. **Use project-specific files**: For store-specific rules, use `project-` prefix
5. **Sync regularly**: Run `cursor-sync` when starting work on a project

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
