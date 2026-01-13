# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-01-XX

### BREAKING CHANGES

- **Repository configuration now required**: Default repository URL removed. Users must configure their own cursor rules repository before using the CLI.
- **Removed embedded cursor rules**: The `.cursor/` folder has been removed from this repository. This package is now a generic CLI tool that syncs rules from user-configured repositories.

### Changed

- Updated package description to emphasize generic CLI nature
- Enhanced error messages to guide users through repository configuration
- Updated documentation to prominently feature configuration requirements

### Added

- Repository validation before all operations
- Clear error messages when repository is not configured

### Removed

- Default repository URL (now requires user configuration)
- `.cursor/` folder from repository (moved to separate repository)

## [2.0.0] - 2026-01-XX

### Changed

- Complete refactor: renamed from `cursor-*` commands to `crules` with subcommands
- Package renamed from `@eyyminda/cursor-rules-sync` to `crules-cli`
- Restructured codebase with command handlers in `lib/commands/`
- Added commander.js for better CLI framework

### Added

- Configuration file support (`.cursor-rules.json`)
- `crules config` command for managing configuration
- `--dry-run` flag for sync and push commands
- `--verbose` flag for detailed output
- `--force` flag to skip confirmations
- Better error handling with suggestions
- Support for custom repository URLs
- Support for custom cache directories
- Support for custom project-specific file patterns

### Removed

- Individual command binaries (`cursor-sync`, `cursor-push`, etc.)
- `cursor-help` command (replaced by commander.js help)
- `cursor-sync.ps1` PowerShell script

## [1.1.0] - 2026-XX-XX

### Added

- `cursor-push` command to push changes back to repository
- `cursor-status` command to check differences
- `cursor-diff` command to view file diffs
- Project-specific file preservation (files starting with `project-`)
- Better diff display with line limits

## [1.0.0] - 2026-XX-XX

### Added

- Initial release
- `cursor-sync` command to sync rules from repository
- Basic project-specific file handling
