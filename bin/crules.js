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
  .description('Manage configuration')
  .argument('[action]', 'action: get or set', 'get')
  .argument('[key]', 'configuration key')
  .argument('[value]', 'configuration value (for set action)')
  .option('-g, --global', 'use global config file')
  .action(async (action, key, value, options) => {
    try {
      await configCommand(action, key, value, options);
    } catch (error) {
      process.exit(1);
    }
  });

program.parse();
