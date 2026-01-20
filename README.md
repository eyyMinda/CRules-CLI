# CRules CLI

[![npm version](https://img.shields.io/npm/v/crules-cli.svg)](https://www.npmjs.com/package/crules-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A generic CLI tool to sync [Cursor editor](https://cursor.sh) `.cursor/` folder contents (rules, commands, docs, and more) from **your own** GitHub repository to any project. This tool does **not** include any cursor rules - you must configure your own repository containing your `.cursor` folder. Perfect for teams and individuals who want to maintain consistent coding standards and AI assistant configurations across multiple projects.

## Installation

### Via npm (Recommended)

```bash
npm install -g crules-cli
```

### Via GitHub

```bash
npm install -g git+https://github.com/eyyMinda/CRules-CLI.git
```

## Quick Start

**⚠️ Important:** This CLI tool requires you to configure your own cursor rules repository. The package does not include any cursor rules.

1. **Configure your cursor rules repository (required first step):**

   ```bash
   # Set your repository URL (replace with your own repo)
   crules config set repository https://github.com/username/your-cursor-rules.git

   # Or set it globally for all projects
   crules config set repository https://github.com/username/your-cursor-rules.git --global
   ```

   Your repository should contain a `.cursor` folder with your cursor configuration files (rules, commands, docs, etc.).

2. **Sync rules to your project:**

   ```bash
   crules sync
   ```

3. **Check what's different:**

   ```bash
   crules status
   ```

4. **Push your changes back:**
   ```bash
   crules push
   ```

## Quick Examples

**First time setup:**

```bash
# 1. Configure your cursor rules repository (required)
crules config set repository https://github.com/username/your-cursor-rules.git

# 2. Sync rules to your project
crules sync
```

**Daily usage:**

```bash
# Get latest rules from repository
crules sync

# Check what changed
crules status

# Push your changes back
crules push

# View diff for a specific file
crules diff rules/some-rule.mdc
```

**Multiple configs (for different project types):**

```bash
# Create configs for different project types
crules config create shopify-theme --repository https://github.com/user/shopify-rules.git
crules config create react --repository https://github.com/user/react-rules.git

# Switch between configs
crules config use shopify-theme
crules sync  # Uses shopify-theme config

crules config use react
crules sync  # Uses react config
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

**Examples:**

```bash
crules sync
crules sync --verbose
crules sync --dry-run  # Preview what would change
```

**What it does:**

- Updates the cached repository
- Copies `.cursor` folder to your project
- Preserves project-specific files (files matching the configured pattern)

---

### `crules push`

Push your local changes back to the repository.

```bash
crules push [options]
```

**Options:**

- `-v, --verbose` - Show detailed output
- `--dry-run` - Preview what would be pushed
- `-f, --force` - Skip confirmation prompts

**Examples:**

```bash
crules push
crules push --verbose
crules push --dry-run  # See what would be pushed
crules push --force    # Skip confirmation
```

**What it does:**

- Shows what files were added/modified/deleted
- Optionally shows detailed diff
- Prompts for confirmation (unless `--force`)
- Automatically resolves git identity (user.name and user.email) from:
  - Cache directory git config
  - Global git config (`git config --global`)
  - Current project's git config (if project is a git repository)
- Commits and pushes changes to GitHub

---

### `crules status`

Check what's different between your project and the repository.

```bash
crules status [options]
```

**Options:**

- `-v, --verbose` - Show detailed output

**Examples:**

```bash
crules status
crules status --verbose
```

**What it shows:**

- New files (not in repo)
- Modified files (different from repo)
- Deleted files (in repo but not in project)
- Synced files count

---

### `crules diff <file>`

View detailed diff for a specific file.

```bash
crules diff <file-path> [options]
```

**Options:**

- `-v, --verbose` - Show unchanged lines

**Examples:**

```bash
crules diff rules/shopify-reusable-snippets.mdc
crules diff commands/generate-component.mdc --verbose
```

---

### `crules config`

Manage configuration settings and multiple config profiles.

```bash
crules config <action> [arguments] [options]
```

**Actions:**

- `list` - List all available configs
- `get [key]` - Get active config (or specific key)
- `set <key> <value>` - Set value in active config
- `use <alias>` - Switch to a named config
- `create <alias>` - Create a new named config
- `edit <alias> <key> <value>` - Edit a specific config value
- `rename <old-alias> <new-alias>` - Rename a config alias
- `delete <alias>` - Delete a config

**Options:**

- `-g, --global` - Use global config file (`~/.cursor-rules.json`)
- `-a, --alias <alias>` - Specify config alias for get/set operations
- `-r, --repository <url>` - Repository URL (for create command)
- `-p, --pattern <pattern>` - Project-specific pattern (for create command)
- `-m, --commit-message <message>` - Commit message template (for create command)

**Examples:**

```bash
# List all configs
crules config list

# Show active configuration
crules config get

# Get specific value
crules config get repository

# Set repository URL
crules config set repository https://github.com/user/repo.git
crules config set repository https://github.com/user/repo.git --global

# Create and use a new config
crules config create shopify-theme --repository https://github.com/user/shopify-rules.git
crules config use shopify-theme

# Edit a config value
crules config edit shopify-theme repository https://github.com/user/new-repo.git

# Rename a config
crules config rename shopify-theme shopify-app

# Delete a config
crules config delete shopify-theme
```

## Features

- 🔄 **Sync** `.cursor/` folder contents from repository to any project
- 📤 **Push** local changes back to the repository
- 📊 **Status** check to see what's different
- 🔍 **Diff** view for individual files
- ⚙️ **Multiple configs** - Switch between different cursor rules repositories
- 🛡️ **Auto-preserve** project-specific files
- 🚀 **Dry-run** mode to preview changes
- 📝 **Verbose** output for debugging

## Configuration

**🔴 Required:** You **must** configure a repository URL before using this tool. The CLI will not work without a configured repository.

CRules CLI supports **multiple named configs**, allowing you to switch between different cursor rules repositories for different project types (e.g., React development, Shopify themes, Shopify apps).

Configuration can be set globally (`~/.cursor-rules.json`) or per-project (`.cursor-rules.json` in project root). Local config overrides global config.

### Multiple Configs

You can create multiple config profiles with aliases to manage different cursor rules repositories:

- **Default config**: No alias required, always available
- **Named configs**: Must have an alias (e.g., `shopify-theme`, `react`, `shopify-app`)
- **Active config**: The currently selected config used by sync/push/status/diff commands
- **Cache isolation**: Each config has its own cache directory

**Example workflow:**

```bash
# Create configs for different project types
crules config create shopify-theme --repository https://github.com/user/shopify-theme-rules.git
crules config create react --repository https://github.com/user/react-rules.git
crules config create shopify-app --repository https://github.com/user/shopify-app-rules.git

# Switch between configs
crules config use shopify-theme  # Now sync/push will use shopify-theme config
crules config use react           # Switch to react config

# List all configs
crules config list
```

### Setting Up Your Repository

1. Create a GitHub repository (or use an existing one) that contains your `.cursor` folder
2. The repository should have a structure like:
   ```
   your-repo/
   └── .cursor/
       ├── rules/
       │   └── your-rules.mdc
       ├── commands/
       │   └── your-commands.mdc
       └── docs/
           └── your-docs.md
   ```
3. Configure the repository URL:

   ```bash
   # For default config
   crules config set repository https://github.com/username/your-cursor-rules.git

   # Or create a named config
   crules config create my-config --repository https://github.com/username/your-cursor-rules.git
   crules config use my-config
   ```

### Supported .cursor/ Folder Types

CRules CLI supports syncing all folders within the `.cursor/` directory. The following folder types are fully supported with project-specific file preservation:

#### `rules/` - Coding Rules and Guidelines

- **Purpose**: Contains MDC (Markdown Cursor) files with coding rules, best practices, and guidelines
- **File Extension**: `.mdc` files
- **Example**: `rules/shopify-reusable-snippets.mdc`, `rules/typescript-best-practices.mdc`
- **Project-Specific**: Files matching `projectSpecificPattern` (e.g., `project-7879-specific.mdc`) are preserved during sync

#### `commands/` - Custom Cursor Commands

- **Purpose**: Contains custom command files that extend Cursor's functionality
- **File Extension**: Any extension (typically `.js`, `.ts`, `.mdc`, etc.)
- **Example**: `commands/generate-component.mdc`, `commands/setup-project.js`
- **Project-Specific**: Files matching `projectSpecificPattern` are preserved during sync

#### `docs/` - Documentation Files

- **Purpose**: Contains project documentation, guides, and reference materials
- **File Extension**: Any extension (typically `.md`, `.txt`, etc.)
- **Example**: `docs/architecture.md`, `docs/api-reference.md`
- **Project-Specific**: Files matching `projectSpecificPattern` are preserved during sync

**Note**: While CRules CLI recursively syncs the entire `.cursor/` folder (supporting any subdirectories), project-specific file preservation currently works for `rules/`, `commands/`, and `docs/` folders. Files in other folders are synced but project-specific files in those folders won't be automatically preserved.

### Configuration Options

**New Multi-Config Format:**

```json
{
  "active": "shopify-theme",
  "configs": {
    "default": {
      "repository": "https://github.com/username/cursor-rules.git",
      "cacheDir": "~/.cursor-rules-cache/default",
      "projectSpecificPattern": "^project-",
      "commitMessage": "Update cursor rules: {summary}"
    },
    "shopify-theme": {
      "repository": "https://github.com/username/shopify-theme-rules.git",
      "cacheDir": "~/.cursor-rules-cache/shopify-theme",
      "projectSpecificPattern": "^project-",
      "commitMessage": "Update cursor rules: {summary}"
    },
    "react": {
      "repository": "https://github.com/username/react-rules.git",
      "cacheDir": "~/.cursor-rules-cache/react",
      "projectSpecificPattern": "^project-",
      "commitMessage": "Update cursor rules: {summary}"
    }
  }
}
```

**Config Properties:**

- **active**: Name of the currently active config (defaults to "default")
- **configs**: Object containing all config profiles
  - **default**: The default config (no alias, always exists)
  - **[alias]**: Named configs with aliases (e.g., "shopify-theme", "react")

**Per-Config Options:**

- **repository** (required): Git repository URL containing your `.cursor` folder. Must be configured before using any commands.
- **cacheDir**: Local directory to cache the repository (supports `~` expansion). Named configs automatically use `~/.cursor-rules-cache/{alias}` unless customized.
- **projectSpecificPattern**: Regex pattern to identify project-specific files
- **commitMessage**: Commit message template (use `{summary}` placeholder)

**Note:** Old single-config format is automatically migrated to the new multi-config format on first use.

### Project-Specific Files

Files matching the `projectSpecificPattern` (default: `^project-`) are:

- ✅ **Preserved** during sync (not overwritten)
- 🚫 **Ignored** during push (not pushed to repository)

**Example:**

- `rules/project-7879-specific.mdc` ✅ Preserved (project-specific)
- `commands/project-store-xyz.mdc` ✅ Preserved (project-specific)
- `docs/project-internal-guide.md` ✅ Preserved (project-specific)
- `rules/shopify-reusable-snippets.mdc` ❌ Synced from repo (shared)
- `commands/generate-component.mdc` ❌ Synced from repo (shared)

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
# Option 1: Use default config
# 1. Configure repository (required - no default repository)
crules config set repository https://github.com/your-org/cursor-rules.git

# 2. Sync rules
crules sync

# Option 2: Use a named config
# 1. Switch to existing config (if you have one)
crules config use shopify-theme

# 2. Or create a new config for this project type
crules config create shopify-theme --repository https://github.com/your-org/shopify-rules.git
crules config use shopify-theme

# 3. Sync rules
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

### Repository not configured

**Error:** `Repository not configured. Please set it using: crules config set repository <your-repo-url>`

**Solution:**

- Configure your repository URL: `crules config set repository <your-repo-url>`
- Verify configuration: `crules config get repository`
- See [Configuration](#configuration) section for details

### Repository not found

**Error:** `Failed to clone repository`

**Solution:**

- Check your internet connection
- Verify the repository URL is correct: `crules config get repository`
- Ensure git is installed: `git --version`
- Check repository permissions (if private, ensure SSH keys are set up)
- Ensure your repository contains a `.cursor` folder

### Git push fails

**Error:** `Failed to push changes` or `Git user.name and user.email are not configured`

**Solution:**

- **Git identity is automatically resolved** - The CLI will try to find git identity from:
  1. Cache directory's git config
  2. Your global git config (`git config --global`)
  3. Your current project's git config (if the project is a git repository)
- If none are found, configure git identity:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```
- Ensure you have write access to the repository
- Verify remote URL: `cd ~/.cursor-rules-cache && git remote -v`
- If upstream branch is missing, the CLI will automatically set it on first push

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
- Git identity configured (user.name and user.email) - usually already set globally
- Network access (for repository operations)

**Note:** Git identity is automatically resolved from your global git config, cache directory, or current project. Most users don't need to configure anything additional.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [Cursor Editor](https://cursor.sh) - The AI-powered code editor this tool is designed for

## Support

- 📖 [Documentation](https://github.com/eyyMinda/CRules-CLI#readme)
- 🐛 [Report Issues](https://github.com/eyyMinda/CRules-CLI/issues)
- 💬 [Discussions](https://github.com/eyyMinda/CRules-CLI/discussions)

---

Made with ❤️ for the Cursor community
