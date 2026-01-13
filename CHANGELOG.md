# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
