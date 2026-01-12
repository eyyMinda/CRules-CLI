# CRules CLI

[![npm version](https://img.shields.io/npm/v/crules-cli.svg)](https://www.npmjs.com/package/crules-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note:** This package (`crules-cli`) is different from [`cursor-rules-cli`](https://github.com/CyberWalrus/cursor-rules-cli) by CyberWalrus. This tool focuses on syncing Cursor rules from a centralized repository, while `cursor-rules-cli` provides a comprehensive rules system for Cursor IDE.

A powerful CLI tool to sync [Cursor editor](https://cursor.sh) rules and commands from a centralized GitHub repository to any project. Perfect for teams and individuals who want to maintain consistent coding standards and AI assistant configurations across multiple projects.

## Features

- 🔄 **Sync** rules from repository to any project
- 📤 **Push** local changes back to the repository
- 📊 **Status** check to see what's different
- 🔍 **Diff** view for individual files
- ⚙️ **Configuration** management via config files
- 🛡️ **Auto-preserve** project-specific files
- 🚀 **Dry-run** mode to preview changes
- 📝 **Verbose** output for debugging

## Installation

### Via npm (Recommended)

```bash
npm install -g crules-cli
```

### Via GitHub

```bash
npm install -g git+https://github.com/eyyMinda/Cursor-Rules.git
```

## Quick Start

1. **Sync rules to your project:**

   ```bash
   crules sync
   ```

2. **Check what's different:**

   ```bash
   crules status
   ```

3. **Push your changes back:**
   ```bash
   crules push
   ```

## Commands

### `crules sync`

Sync rules from the repository to your current project.

```bash
crules sync [options]
```

**Options:**

- `-v, --verbose` - Show detailed output
- `--dry-run` - Preview changes without applying them

**What it does:**

- Updates the cached repository
- Copies `.cursor` folder to your project
- Preserves project-specific files (files matching the configured pattern)

### `crules push`

Push your local changes back to the repository.

```bash
crules push [options]
```

**Options:**

- `-v, --verbose` - Show detailed output
- `--dry-run` - Preview what would be pushed
- `-f, --force` - Skip confirmation prompts

**What it does:**

- Shows what files were added/modified/deleted
- Optionally shows detailed diff
- Prompts for confirmation (unless `--force`)
- Commits and pushes changes to GitHub

### `crules status`

Check what's different between your project and the repository.

```bash
crules status [options]
```

**Options:**

- `-v, --verbose` - Show detailed output

**What it shows:**

- New files (not in repo)
- Modified files (different from repo)
- Deleted files (in repo but not in project)
- Synced files count

### `crules diff <file>`

View detailed diff for a specific file.

```bash
crules diff <file-path> [options]
```

**Options:**

- `-v, --verbose` - Show unchanged lines

**Example:**

```bash
crules diff rules/shopify-reusable-snippets.mdc
```

### `crules config`

Manage configuration settings.

```bash
crules config [get|set] [key] [value] [options]
```

**Options:**

- `-g, --global` - Use global config file (`~/.cursor-rules.json`)

**Examples:**

```bash
# Show all configuration
crules config get

# Get specific value
crules config get repository

# Set a value (local config)
crules config set repository https://github.com/user/repo.git

# Set a value (global config)
crules config set repository https://github.com/user/repo.git --global
```

## Configuration

Configuration can be set globally (`~/.cursor-rules.json`) or per-project (`.cursor-rules.json` in project root). Local config overrides global config.

### Configuration Options

```json
{
  "repository": "https://github.com/username/cursor-rules.git",
  "cacheDir": "~/.cursor-rules-cache",
  "projectSpecificPattern": "^project-",
  "commitMessage": "Update cursor rules: {summary}"
}
```

- **repository**: Git repository URL containing your `.cursor` folder
- **cacheDir**: Local directory to cache the repository (supports `~` expansion)
- **projectSpecificPattern**: Regex pattern to identify project-specific files
- **commitMessage**: Commit message template (use `{summary}` placeholder)

### Project-Specific Files

Files matching the `projectSpecificPattern` (default: `^project-`) are:

- ✅ **Preserved** during sync (not overwritten)
- 🚫 **Ignored** during push (not pushed to repository)

**Example:**

- `project-7879-specific.mdc` ✅ Preserved (project-specific)
- `project-store-xyz.mdc` ✅ Preserved (project-specific)
- `shopify-reusable-snippets.mdc` ❌ Synced from repo (shared)

## Typical Workflow

### Working on rules in a project:

```bash
# 1. Make changes to rules in your project
# Edit .cursor/rules/some-rule.mdc

# 2. Check what changed
crules status

# 3. Review detailed diff (optional)
crules diff rules/some-rule.mdc

# 4. Push changes to repository
crules push
```

### Getting latest rules in a project:

```bash
# Just sync from repo
crules sync
```

### Setting up a new project:

```bash
# 1. Configure repository (if different from default)
crules config set repository https://github.com/your-org/cursor-rules.git

# 2. Sync rules
crules sync
```

## Best Practices

1. **Always check status before pushing**: Run `crules status` first
2. **Review diffs**: Use `crules diff` to see exactly what changed
3. **Use dry-run**: Test with `--dry-run` before making changes
4. **Commit often**: Push changes regularly so other projects stay updated
5. **Use project-specific files**: For project-specific rules, use files matching your pattern
6. **Sync regularly**: Run `crules sync` when starting work on a project
7. **Configure globally**: Set common settings in `~/.cursor-rules.json`

## Troubleshooting

### Repository not found

**Error:** `Failed to clone repository`

**Solution:**

- Check your internet connection
- Verify the repository URL is correct: `crules config get repository`
- Ensure git is installed: `git --version`
- Check repository permissions (if private, ensure SSH keys are set up)

### Git push fails

**Error:** `Failed to push changes`

**Solution:**

- Ensure you have write access to the repository
- Check git credentials: `git config --global user.name` and `git config --global user.email`
- Verify remote URL: `cd ~/.cursor-rules-cache && git remote -v`

### Project-specific files being overwritten

**Solution:**

- Check your pattern: `crules config get projectSpecificPattern`
- Ensure filenames match the pattern (default: starts with `project-`)
- Verify pattern is a valid regex

### Cache issues

**Solution:**

- Clear cache: Delete `~/.cursor-rules-cache`
- Re-sync: `crules sync` will recreate the cache

## Requirements

- Node.js >= 14.0.0
- Git installed and configured
- Network access (for repository operations)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [Cursor Editor](https://cursor.sh) - The AI-powered code editor this tool is designed for

## Support

- 📖 [Documentation](https://github.com/eyyMinda/Cursor-Rules#readme)
- 🐛 [Report Issues](https://github.com/eyyMinda/Cursor-Rules/issues)
- 💬 [Discussions](https://github.com/eyyMinda/Cursor-Rules/discussions)

---

Made with ❤️ for the Cursor community
