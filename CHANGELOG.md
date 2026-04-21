# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`crules pull`** - Pull rules from repository (replaces `crules sync`)
- **`--local` / `-l`** - Per-project config: create or modify config in `./.crules-cli-config.json` (project root). Use with `config` and `ignore` commands.
- **Ignore list** - `crules ignore add/remove/list` to exclude patterns/files from pull, push, status
- **Status differentiation** - "Modified" (local changes) vs "Outdated" (remote has updates)
- **Diff improvements** - Unified diff focused on changes only; `-v` for context lines
- **`--quiet` / `-q`** - Suppress non-error output on pull, push, status, diff
- **`--no-cache-update`** - Skip git pull in cache for pull command
- **`--no-pull`** - Skip auto-pull when remote ahead on push (fail instead)
- **Code of Conduct** - Added CODE_OF_CONDUCT.md (Contributor Covenant 2.1)

### Changed

- **Config structure** - Global: `~/.crules-cli/.crules-cli-config.json`, cache under `~/.crules-cli/{alias}/`. Per-project: `./.crules-cli-config.json` with `--local` flag.
- **Removed `crules sync`** - Use `crules pull` instead
- **Config** - New `ignoreList` option (array of glob patterns)

### Removed

- **Migration/backwards compatibility** - No auto-migration from old paths. Only new structure (`~/.crules-cli/`) is supported.
- Status output - Now shows "Modified - local changes" and "Outdated - remote has updates" sections

### Fixed

- Diff output now shows only changed lines by default (unified diff style)

---

## [1.2.4] - 2026-04-21

### Fixed

- Updated TUI prompts to use `select` with Inquirer v13, so menu options render correctly instead of showing only prompt text.
- Improved config and ignore navigation so Back returns to the previous menu level, and dead-end actions now offer consistent Back/Exit choices.
- Centralized TUI navigation labels/values for Back/Exit into shared constants to simplify future updates.

---

## [1.2.3] - 2026-04-21

### Fixed

- `crules` no-argument startup now lazy-loads TUI, so prompt module issues no longer block non-TUI commands like `--version`, `status`, `pull`, or `push`.
- Added a bin-level smoke test that validates `bin/crules.js --version` works without entering interactive prompt flow.
- `crules config create` now retries alias input until valid, supports `cancel`, and rejects existing aliases in both direct and interactive flows.

---

## [1.2.2] - 2026-04-21

### Fixed

- `crules config create` now prompts for alias when missing, then continues interactive setup without hanging behind a loader spinner.
- `crules` interactive menu now supports both `inquirer.prompt` and `inquirer.default.prompt`, preventing startup crashes on newer inquirer export shapes.
- project-specific matching now correctly handles nested paths (such as `skills/project-*/SKILL.md`) and avoids `EISDIR` failures during pull backups.

---

## [1.2.1] - 2026-04-15

### Changed

- Bumped npm dependencies.

---

## [1.2.0] - 2026-03-26

### Added

- Vitest coverage across commands and shared code: `status`, `push`, `sync` (pull), `diff`, `config` CLI dispatch, `ignore`, `utils`, and a minimal `tui` export check (alongside existing `config` and `version-check` tests).

### Changed

- Command internals call shared `utils` module members where tests need to spy or stub (e.g. git exec, remote diff paths, cache/path helpers).

### Fixed

- `crules config edit` passes Commander options through to the edit handler so flag-style usage behaves like positional arguments.

### Documentation

- README: Node **20+** in Requirements (aligned with `engines`); Contributing blurb for `npm test` / Vitest.
- CONTRIBUTING: Vitest scripts, `vitest.config.mjs`, table of `test/*.test.js` files and conventions (temp dirs / `HOME`).

---

## [1.1.15] - 2026-03-26

### Added

- Vitest for unit tests (`npm test` → `vitest run`, `npm run test:watch`).

### Changed

- Prettier includes `vitest.config.mjs`; CONTRIBUTING documents Vitest-based tests.

## [1.1.14] - 2026-03-26

### Fixed

- Release workflow verifies `package.json` `version` matches the pushed `v*` tag before `npm publish`, so the npm tarball and GitHub Release stay aligned.

### Changed

- CONTRIBUTING: release steps note that the tag must point at the version-bump commit (`npm publish` uses `package.json`, not the tag name).

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
