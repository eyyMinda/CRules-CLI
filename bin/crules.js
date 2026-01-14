#!/usr/bin/env node

const { Command } = require('commander');
const packageJson = require('../package.json');
const syncCommand = require('../lib/commands/sync');
const pushCommand = require('../lib/commands/push');
const statusCommand = require('../lib/commands/status');
const diffCommand = require('../lib/commands/diff');
const configCommand = require('../lib/commands/config');

const program = new Command();

program
  .name('crules')
  .description('CLI tool to sync Cursor editor rules and commands from a centralized repository')
  .version(packageJson.version);

program
  .command('sync')
  .description('Sync rules from repository to current project')
  .option('-v, --verbose', 'verbose output')
  .option('--dry-run', 'show what would be synced without making changes')
  .action(async (options) => {
    try {
      await syncCommand(options);
    } catch (error) {
      process.exit(1);
    }
  });

program
  .command('push')
  .description('Push local changes back to repository')
  .option('-v, --verbose', 'verbose output')
  .option('--dry-run', 'show what would be pushed without making changes')
  .option('-f, --force', 'skip confirmation prompts')
  .action(async (options) => {
    try {
      await pushCommand(options);
    } catch (error) {
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check differences between project and repository')
  .option('-v, --verbose', 'verbose output')
  .action(async (options) => {
    try {
      await statusCommand(options);
    } catch (error) {
      process.exit(1);
    }
  });

program
  .command('diff <file>')
  .description('Show diff for a specific file')
  .option('-v, --verbose', 'show unchanged lines')
  .action(async (filePath, options) => {
    try {
      await diffCommand(filePath, options);
    } catch (error) {
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration and multiple config profiles')
  .argument('[action]', 'action: list, get, set, use, create, delete, edit, rename', 'get')
  .argument('[key]', 'configuration key, alias, or old alias (depending on action)')
  .argument('[value]', 'configuration value, new alias, or config key (depending on action)')
  .argument('[extra]', 'extra value for edit command (config value when action is edit)')
  .option('-g, --global', 'use global config file')
  .option('-a, --alias <alias>', 'specify config alias for get/set operations')
  .option('-r, --repository <url>', 'repository URL (for create command)')
  .option('-p, --pattern <pattern>', 'project-specific pattern (for create command)')
  .option('-m, --commit-message <message>', 'commit message template (for create command)')
  .option('--key <key>', 'config key (for edit command)')
  .option('--value <value>', 'config value (for edit command)')
  .action(async (action, key, value, extra, options) => {
    try {
      // For edit command: action=edit, key=alias, value=configKey, extra=configValue
      // Or use --key and --value options
      if (action === 'edit' && (options.key || options.value)) {
        await configCommand(action, key, options.key || value, { ...options, editValue: options.value || extra });
      } else if (action === 'edit' && extra) {
        // edit alias key value format
        await configCommand(action, key, value, { ...options, editValue: extra });
      } else {
        await configCommand(action, key, value, options);
      }
    } catch (error) {
      process.exit(1);
    }
  });

program.parse();
