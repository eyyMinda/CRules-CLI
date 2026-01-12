# Contributing to Cursor Rules CLI

Thank you for your interest in contributing to Cursor Rules CLI! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Be open to different perspectives

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
   cd Cursor-Rules
   ```

2. Install dependencies (for development):

   ```bash
   npm install
   ```

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

## Project Structure

- `bin/` - CLI entry point
- `lib/` - Core library code
  - `commands/` - Command handlers
  - `config.js` - Configuration management
  - `utils.js` - Shared utilities

## Questions?

Feel free to open an issue for any questions or concerns.

Thank you for contributing! 🎉
