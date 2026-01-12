#!/usr/bin/env node

console.log(`
📚 Cursor Rules Sync - Command Reference

COMMANDS:
  cursor-sync       Sync rules from repository to current project
  cursor-push       Push local changes back to repository
  cursor-status     Check what's different between project and repo
  cursor-diff       Show detailed diff for a specific file
  cursor-version    Show version information
  cursor-help       Show this help message

EXAMPLES:
  cursor-sync
  cursor-status
  cursor-push
  cursor-diff rules/shopify-reusable-snippets.mdc

WORKFLOW:
  1. Make changes to rules in your project
  2. Run 'cursor-status' to see what changed
  3. Run 'cursor-diff <file>' to review changes
  4. Run 'cursor-push' to push changes to repo
  5. Other projects can 'cursor-sync' to get updates

PROJECT-SPECIFIC FILES:
  Files starting with 'project-' are preserved during sync
  and ignored during push. Use them for store-specific rules.

For more details, see: https://github.com/eyyMinda/CRules-CLI
`);
