const inquirer = require('inquirer');
const syncCommand = require('./sync');
const pushCommand = require('./push');
const statusCommand = require('./status');
const diffCommand = require('./diff');
const configCommand = require('./config');
const ignoreCommand = require('./ignore');
const { ensureCache } = require('../utils');

const CHOICES = {
  pull: { name: 'Pull - Get latest from repository', value: 'pull' },
  push: { name: 'Push - Push local changes', value: 'push' },
  status: { name: 'Status - See what\'s different', value: 'status' },
  diff: { name: 'Diff - View diff for a file', value: 'diff' },
  config: { name: 'Config - Manage configuration', value: 'config' },
  ignore: { name: 'Ignore - Manage ignore list', value: 'ignore' },
  exit: { name: 'Exit', value: 'exit' }
};

const baseOptions = { quiet: false };

async function runAction(choice) {
  switch (choice) {
    case 'pull':
      await syncCommand({ ...baseOptions });
      break;
    case 'push':
      await pushCommand({ ...baseOptions, force: false });
      break;
    case 'status':
      await statusCommand(baseOptions);
      break;
    case 'diff': {
      const { filePath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filePath',
          message: 'File path (e.g. rules/foo.mdc):',
          validate: (v) => (v.trim() ? true : 'Path is required')
        }
      ]);
      await diffCommand(filePath.trim(), baseOptions);
      break;
    }
    case 'config': {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Config action:',
          choices: [
            { name: 'List configs', value: 'list' },
            { name: 'Get setting', value: 'get' },
            { name: 'Set setting', value: 'set' },
            { name: 'Use config (switch alias)', value: 'use' },
            { name: 'Back', value: 'back' }
          ]
        }
      ]);
      if (action === 'back') return;
      let key, value;
      if (action !== 'list') {
        const keyPrompt = await inquirer.prompt([
          { type: 'input', name: 'key', message: action === 'use' ? 'Alias:' : 'Key:' }
        ]);
        key = keyPrompt.key?.trim();
        if (action === 'set' && key) {
          const valPrompt = await inquirer.prompt([
            { type: 'input', name: 'value', message: 'Value:' }
          ]);
          value = valPrompt.value;
        }
      }
      await configCommand(action, key, value, {});
      break;
    }
    case 'ignore': {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Ignore action:',
          choices: [
            { name: 'List', value: 'list' },
            { name: 'Add pattern', value: 'add' },
            { name: 'Remove pattern', value: 'remove' },
            { name: 'Back', value: 'back' }
          ]
        }
      ]);
      if (action === 'back') return;
      let pattern;
      if (action !== 'list') {
        const p = await inquirer.prompt([
          { type: 'input', name: 'pattern', message: 'Pattern or path:' }
        ]);
        pattern = p.pattern?.trim();
      }
      await ignoreCommand(action, pattern, {});
      break;
    }
    case 'exit':
      process.exit(0);
  }
}

async function runTUI() {
  try {
    await ensureCache(false);
  } catch (err) {
    console.error('\n❌', err.message);
    process.exit(1);
  }

  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'What would you like to do?',
      choices: Object.values(CHOICES)
    }
  ]);

  if (choice === 'exit') {
    process.exit(0);
  }

  try {
    await runAction(choice);
  } catch (err) {
    // Error already displayed by command (loader.fail + suggestions)
  }

  // Loop back to menu
  const { again } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'again',
      message: 'Back to menu?',
      default: true
    }
  ]);
  if (again) await runTUI();
}

module.exports = runTUI;
