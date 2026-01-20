# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-01-17

### Fixed

- **Non-Fast-Forward Push Errors**: Automatically handles `non-fast-forward` errors when pushing. The CLI now:
  - Detects when remote has changes that conflict with local commits
  - Automatically performs `git pull --rebase` to integrate remote changes
  - Retries the push after successfully rebasing
  - Provides clear error messages with resolution steps if merge conflicts occur during rebase

## [1.0.2] - 2026-01-17

### Fixed

- **Git Identity Handling**: Fixed push failures when pushing from different repositories. The CLI now automatically resolves git identity (user.name and user.email) from:
  - Cache directory git config
  - Global git config (`git config --global`)
  - Current project's git config (if project is a git repository)
- **Upstream Branch**: Automatically sets upstream branch on first push if not configured
- **Better Error Messages**: Improved error messages when git identity is missing with clear instructions

### Changed

- Enhanced documentation for git push troubleshooting and requirements

## [1.0.1] - 2026-01-13

### Added

- **Multiple Configs Support**: Create and manage multiple named configs for different project types (e.g., `shopify-theme`, `react`, `shopify-app`)
- **Config Management Commands**:
  - `crules config create <alias>` - Create new named config
  - `crules config use <alias>` - Switch active config
  - `crules config list` - List all available configs
  - `crules config edit <alias> <key> <value>` - Edit specific config value
  - `crules config rename <old-alias> <new-alias>` - Rename config alias
  - `crules config delete <alias>` - Delete a config
- **Per-Config Cache Isolation**: Each config has its own cache directory (`~/.cursor-rules-cache/{alias}`)
- **Auto-Migration**: Old single-config format automatically migrates to new multi-config format

### Changed

- Config file structure now supports multiple configs with `active` and `configs` properties
- Default config is always available (no alias required)
- Config commands now use gear icon (⚙️) instead of light bulb icon
- README reorganized for better user experience (Quick Start before Quick Examples)

### Fixed

- Improved config file merging logic (global vs local)
- Better error messages for config operations

### Backward Compatibility

- ✅ Simple 3-step workflow (install → set repo → sync) still works exactly as before
- ✅ Old config files automatically migrate to new format
- ✅ No breaking changes - existing users can continue using the tool without any changes

## [1.0.0] - 2026-01-XX

### Initial Release

A generic CLI tool to sync Cursor editor rules and commands from your own GitHub repository to any project.

### Features

- **Sync** rules from repository to any project
- **Push** local changes back to the repository
- **Status** check to see what's different
- **Diff** view for individual files
- **Configuration** management via config files
- **Auto-preserve** project-specific files
- **Dry-run** mode to preview changes
- **Verbose** output for debugging

### Commands

- `crules sync` - Sync rules from repository to current project
- `crules push` - Push local changes back to repository
- `crules status` - Check differences between project and repository
- `crules diff <file>` - Show diff for a specific file
- `crules config` - Manage configuration settings

### Configuration

- Repository URL must be configured (no default)
- Supports global (`~/.cursor-rules.json`) and local (`.cursor-rules.json`) configuration
- Custom cache directories
- Custom project-specific file patterns
- Custom commit message templates

### Requirements

- Repository configuration is **required** before using any commands
- Users must configure their own cursor rules repository
- This package does not include any cursor rules
