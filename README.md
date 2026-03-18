# CRules CLI

[![npm version](https://img.shields.io/npm/v/crules-cli.svg)](https://www.npmjs.com/package/crules-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI tool to pull and push plugin configurations from **your own** repository to any project. Supports the **open plugin standard** — rules, skills, agents, hooks, MCP and LSP configs — as well as legacy `.cursor/` layouts. Configure your own repository; the package does not include any rules or plugins.

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

   Your repository should follow the [open plugin standard](#open-plugin-standard) or contain a `.cursor/` folder.

2. **Pull rules to your project:**

   ```bash
   crules pull
   ```

3. **Check what's different:**

   ```bash
   crules status
   ```

4. **Push your changes back:**
   ```bash
   crules push
   ```

**Interactive mode:** Run `crules` with no arguments to launch an interactive menu for Pull, Push, Status, Diff, Config, and Ignore.

## Quick Examples

**First time setup:**

```bash
# 1. Configure your cursor rules repository (required)
crules config set repository https://github.com/username/your-cursor-rules.git

# 2. Pull rules to your project
crules pull
```

**Daily usage:**

```bash
# Get latest rules from repository
crules pull

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
crules pull  # Uses shopify-theme config

crules config use react
crules pull  # Uses react config
```

## Commands

### `crules` (interactive mode)

Run without a subcommand to open an interactive menu:

```bash
crules
```

- **Pull** – Get latest from repository
- **Push** – Push local changes
- **Status** – See what's different
- **Diff** – View diff for a file (prompts for path)
- **Config** – List, get, set, or switch configs
- **Ignore** – List, add, or remove ignore patterns
- **Exit** – Quit

After each action you can return to the menu. Use `crules -h` for non-interactive help.

### `crules pull`

Pull rules from the repository to your current project.

```bash
crules pull [options]
```

**Options:**

- `-v, --verbose` - Show detailed output
- `-q, --quiet` - Suppress non-error output
- `--dry-run` - Preview changes without applying them
- `--no-cache-update` - Skip git pull in cache, use existing cache only

**Examples:**

```bash
crules pull
crules pull --verbose
crules pull --dry-run       # Preview what would change
crules pull --no-cache-update  # Use cached repo without fetching
crules pull -q              # Quiet mode for scripts
```

**What it does:**

- Updates the cached repository (unless `--no-cache-update`)
- Copies `.cursor` folder to your project
- Preserves project-specific files (files matching the configured pattern)
- Respects ignore list (excluded files are not copied)

---

### `crules push`

Push your local changes back to the repository.

```bash
crules push [options]
```

**Options:**

- `-v, --verbose` - Show detailed output
- `-q, --quiet` - Suppress non-error output
- `--dry-run` - Preview what would be pushed
- `-f, --force` - Skip confirmation prompts
- `--no-pull` - Skip auto-pull when remote is ahead (fail instead)

**Examples:**

```bash
crules push
crules push --verbose
crules push --dry-run   # See what would be pushed
crules push --force     # Skip confirmation
crules push --no-pull   # Fail if remote has changes (use crules pull first)
crules push -q -f       # Quiet, no prompts
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
- `-q, --quiet` - Suppress non-error output

**Examples:**

```bash
crules status
crules status --verbose
crules status -q
```

**What it shows:**

- **New files** - Not in repo
- **Modified** - Local changes (project differs from repo)
- **Deleted** - In repo but not in project
- **Outdated** - Remote has updates (need `crules pull`)
- **Synced** - In sync count

---

### `crules diff <file>`

View unified diff for a specific file. Shows only changed lines by default.

```bash
crules diff <file-path> [options]
```

**Options:**

- `-v, --verbose` - Show 3 lines of context around changes
- `-q, --quiet` - Suppress diff output

**Examples:**

```bash
crules diff rules/shopify-reusable-snippets.mdc
crules diff commands/generate-component.mdc --verbose
crules diff rules/some.mdc -q   # Check exit code only
```

---

### `crules ignore`

Manage ignore list — patterns or files excluded from pull, push, and status.

```bash
crules ignore <action> [pattern] [options]
```

**Actions:**

- `add <pattern|file>` - Add pattern or path to ignore list
- `remove <pattern|file>` - Remove from ignore list
- `list` - Show current ignore entries

**Options:**

- `-g, --global` - Use global config
- `-a, --alias <alias>` - Target specific config

**Examples:**

```bash
crules ignore add "*.bak"
crules ignore add "rules/draft-*.mdc"
crules ignore add "commands/experimental.js"
crules ignore list
crules ignore remove "*.bak"
crules ignore add "*.tmp" -g          # Global config
crules ignore list -a shopify-theme   # For specific config
```

**Patterns:** Use glob patterns (e.g. `*.bak`, `rules/draft-*`) or exact paths. Entries can also be edited manually in `.cursor-rules.json` under `ignoreList`.

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

- 🔄 **Pull** `.cursor/` folder contents from repository to any project
- 📤 **Push** local changes back to the repository
- 📊 **Status** check (modified vs outdated, local changes vs remote updates)
- 🔍 **Diff** unified diff for individual files (focused on changes)
- 🚫 **Ignore list** - Exclude patterns/files from pull, push, status
- ⚙️ **Multiple configs** - Switch between different cursor rules repositories
- 🛡️ **Auto-preserve** project-specific files
- 🚀 **Dry-run** mode to preview changes
- 📝 **Verbose** and **quiet** output modes

## Configuration

**🔴 Required:** You **must** configure a repository URL before using this tool. The CLI will not work without a configured repository.

CRules CLI supports **multiple named configs**, allowing you to switch between different cursor rules repositories for different project types (e.g., React development, Shopify themes, Shopify apps).

Configuration can be set globally (`~/.cursor-rules.json`) or per-project (`.cursor-rules.json` in project root). Local config overrides global config.

### Multiple Configs

You can create multiple config profiles with aliases to manage different cursor rules repositories:

- **Default config**: No alias required, always available
- **Named configs**: Must have an alias (e.g., `shopify-theme`, `react`, `shopify-app`)
- **Active config**: The currently selected config used by pull/push/status/diff commands
- **Cache isolation**: Each config has its own cache directory

**Example workflow:**

```bash
# Create configs for different project types
crules config create shopify-theme --repository https://github.com/user/shopify-theme-rules.git
crules config create react --repository https://github.com/user/react-rules.git
crules config create shopify-app --repository https://github.com/user/shopify-app-rules.git

# Switch between configs
crules config use shopify-theme  # Now pull/push will use shopify-theme config
crules config use react           # Switch to react config

# List all configs
crules config list
```

### Open Plugin Standard

CRules CLI supports the open plugin structure. Your repository can look like:

```
my-plugin/
├── .plugin/
│   └── plugin.json       # Manifest: name, version, metadata
├── skills/               # Agent Skills (SKILL.md format)
├── agents/               # Specialized sub-agents
├── hooks/                # Event-driven automation
├── rules/                # Coding standards (.mdc files)
├── commands/             # Custom commands
├── docs/                 # Documentation
├── .mcp.json             # MCP tool servers
└── .lsp.json             # Language server configs
```

**Config:** Set `sourcePath` to `.` (repo root) and `targetPath` to `.cursor` to sync the plugin into `.cursor/`. Use `targetPath: "."` to place it at project root.

**Legacy `.cursor/` layout:** Default `sourcePath` and `targetPath` are `.cursor` — works with repos that have a `.cursor/` folder.

### Setting Up Your Repository

1. Create a GitHub repository (or use an existing one) with your plugin or `.cursor` folder
2. Either:
   - **Plugin format:** Place `.plugin/`, `skills/`, `rules/`, etc. at repo root (see above)
   - **Legacy format:** Use a `.cursor/` folder with `rules/`, `commands/`, `docs/`
3. Configure the repository URL:

   ```bash
   # For default config
   crules config set repository https://github.com/username/your-cursor-rules.git

   # Or create a named config
   crules config create my-config --repository https://github.com/username/your-cursor-rules.git
   crules config use my-config
   ```

### Supported Folder Types

Project-specific file preservation (files matching `projectSpecificPattern`) works for:

| Folder | Purpose |
|--------|---------|
| `rules/` | Coding standards (.mdc files) |
| `commands/` | Custom commands |
| `docs/` | Documentation |
| `skills/` | Agent skills (SKILL.md format) |
| `agents/` | Specialized sub-agents |
| `hooks/` | Event-driven automation |

All folders are synced recursively. Project-specific files are preserved during pull and excluded from push.

### Configuration Options

**New Multi-Config Format:**

```json
{
  "active": "shopify-theme",
  "configs": {
    "default": {
      "repository": "https://github.com/username/cursor-rules.git",
      "cacheDir": "~/.cursor-rules-cache/default",
      "sourcePath": ".cursor",
      "targetPath": ".cursor",
      "projectSpecificPattern": "^project-",
      "commitMessage": "Update cursor rules: {summary}",
      "ignoreList": []
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

- **repository** (required): Git repository URL. Must be configured before using any commands.
- **cacheDir**: Local directory to cache the repository (supports `~` expansion). Named configs automatically use `~/.cursor-rules-cache/{alias}` unless customized.
- **sourcePath**: Path within the cached repo to sync from (default: `.cursor`). Use `.` or `` for plugin root.
- **targetPath**: Path in the project to sync to (default: `.cursor`). Use `.` for project root.
- **projectSpecificPattern**: Regex pattern to identify project-specific files
- **commitMessage**: Commit message template (use `{summary}` placeholder)
- **ignoreList**: Array of glob patterns or paths to exclude from pull, push, status (e.g. `["*.bak", "rules/draft-*"]`). Manage via `crules ignore add/remove/list` or edit config manually.

**Note:** Old single-config format is automatically migrated to the new multi-config format on first use.

### Project-Specific Files

Files matching the `projectSpecificPattern` (default: `^project-`) are:

- ✅ **Preserved** during pull (not overwritten)
- 🚫 **Ignored** during push (not pushed to repository)

**Example:**

- `rules/project-7879-specific.mdc` ✅ Preserved (project-specific)
- `commands/project-store-xyz.mdc` ✅ Preserved (project-specific)
- `docs/project-internal-guide.md` ✅ Preserved (project-specific)
- `rules/shopify-reusable-snippets.mdc` ❌ Pulled from repo (shared)
- `commands/generate-component.mdc` ❌ Pulled from repo (shared)

### Ignore List

Files/patterns in `ignoreList` are excluded from pull, push, and status. Use `crules ignore add/remove/list` or edit `.cursor-rules.json`:

```json
"ignoreList": ["*.bak", "rules/draft-*.mdc", "commands/experimental.js"]
```

- **Pull**: Ignored files are not copied from repo to project
- **Push/Status**: Ignored files are not compared or pushed

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
# Pull from repo
crules pull
```

### Setting up a new project:

```bash
# Option 1: Use default config
# 1. Configure repository (required - no default repository)
crules config set repository https://github.com/your-org/cursor-rules.git

# 2. Pull rules
crules pull

# Option 2: Use a named config
# 1. Switch to existing config (if you have one)
crules config use shopify-theme

# 2. Or create a new config for this project type
crules config create shopify-theme --repository https://github.com/your-org/shopify-rules.git
crules config use shopify-theme

# 3. Pull rules
crules pull
```

## Best Practices

1. **Always check status before pushing**: Run `crules status` first
2. **Review diffs**: Use `crules diff` to see exactly what changed
3. **Use dry-run**: Test with `--dry-run` before making changes
4. **Commit often**: Push changes regularly so other projects stay updated
5. **Use project-specific files**: For project-specific rules, use files matching your pattern
6. **Pull regularly**: Run `crules pull` when starting work on a project
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
- Re-pull: `crules pull` will recreate the cache

## Requirements

- Node.js >= 14.0.0
- Git installed and configured
- Git identity configured (user.name and user.email) - usually already set globally
- Network access (for repository operations)

**Note:** Git identity is automatically resolved from your global git config, cache directory, or current project. Most users don't need to configure anything additional.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

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
