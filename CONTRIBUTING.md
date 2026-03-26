# Contributing to Cursor Rules CLI

Thank you for your interest in contributing to Cursor Rules CLI! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:

- A clear title and description
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (OS, Node.js version, etc.)

### Suggesting Features

Feature suggestions are welcome! Please open an issue with:

- A clear description of the feature
- Use cases and examples
- Why this feature would be useful

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Test your changes thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feat/amazing-feature`)
7. Open a Pull Request

### Code Style

- Follow existing code style and patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small
- Handle errors gracefully

### Testing

Before submitting a PR:

- Test all affected commands
- Test on different operating systems if possible
- Test edge cases and error conditions
- Ensure backward compatibility

## Development Setup

**Note:** This section is for contributors who want to modify the CLI code.
End users should install via `npm install -g crules-cli` (see [README.md](README.md)).

1. Clone the repository:

   ```bash
   git clone https://github.com/eyyMinda/CRules-CLI.git
   cd CRules-CLI
   ```

2. Install dependencies (for development):

   ```bash
   npm install
   ```

   Use **Node.js 20 or later** (see `engines` in `package.json`).

3. Install globally for testing your changes:

   ```bash
   npm install -g .
   ```

   This installs your local development version so you can test `crules` commands.

4. Test your changes:
   ```bash
   crules --help
   crules status
   ```

5. Automated checks (run before opening a PR):

   ```bash
   npm run format:check
   npm test
   ```

## Project Structure

- `bin/` - CLI entry point
- `lib/` - Core library code
  - `commands/` - Command handlers
  - `config.js` - Configuration management
  - `utils.js` - Shared utilities
- `test/` - Vitest unit tests (`npm test` → `vitest run`)

## Important Notes

- **This repository does not contain cursor rules** - it is a generic CLI tool for syncing cursor rules from any repository
- **Do not add `.cursor` folder or cursor rules to this repository** - contributors should focus on improving the CLI tool itself
- End users configure their own cursor rules repositories separately

## Releasing (maintainers)

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC from GitHub Actions). You do **not** store an `NPM_TOKEN` for releases.

### One-time: link the package to this workflow

On [npmjs.com](https://www.npmjs.com/) → your package → **Settings** → **Trusted Publisher** (or **Publishing access** → trusted publishing, depending on UI):

1. Choose **GitHub Actions**.
2. **Repository:** `eyyMinda/CRules-CLI` (must match `repository.url` in `package.json` exactly).
3. **Workflow filename:** `release.yml` (filename only, case-sensitive, including `.yml`).

Save. npm does not validate this until the next publish—double-check spelling.

### Each release

1. Bump `version` in `package.json` (and `package-lock.json` root version) and commit.
2. Create and push a tag matching that version, e.g. `v1.2.3` for `package.json` `1.2.3`. The tag must point at the **same commit** as the bump — npm uses `package.json`, not the tag name; the workflow fails if they disagree.
3. The **Release** workflow runs on `v*` tags: it publishes to npm with OIDC, then creates a **GitHub Release** for that tag (auto-generated release notes). If `npm publish` fails, no release is created.

Optional hardening after a successful publish: package **Settings** → **Publishing access** → restrict token-based publishes (“disallow tokens” / require 2FA) so only trusted publishing can ship releases.

**Private npm dependencies:** Trusted publishing only covers `npm publish`. If you ever add private packages, use a **read-only** granular token for `npm ci` only (`NODE_AUTH_TOKEN`), not for publish—see npm’s “Handling private dependencies” in the trusted publishers doc.

## Questions?

Feel free to open an issue for any questions or concerns.

Thank you for contributing! 🎉
