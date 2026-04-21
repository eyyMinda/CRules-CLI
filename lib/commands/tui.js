const inquirer = require('inquirer');
const promptFactory =
  inquirer.default && typeof inquirer.default.createPromptModule === 'function'
    ? inquirer.default.createPromptModule
    : typeof inquirer.createPromptModule === 'function'
      ? inquirer.createPromptModule
      : null;

const prompt =
  promptFactory?.() ||
  (typeof inquirer.prompt === 'function'
    ? inquirer.prompt
    : inquirer.default && typeof inquirer.default.prompt === 'function'
      ? inquirer.default.prompt
      : null);

if (!prompt) {
  throw new Error('Inquirer prompt API not available');
}
const syncCommand = require('./sync');
const pushCommand = require('./push');
const statusCommand = require('./status');
const diffCommand = require('./diff');
const configCommand = require('./config');
const ignoreCommand = require('./ignore');
const { ensureCache } = require('../utils');

const NAV_VALUES = {
  BACK: 'back',
  EXIT: 'exit'
};

const NAV_LABELS = {
  BACK: 'Back',
  EXIT: 'Exit'
};

const CHOICES = {
  pull: { name: 'Pull - Get latest from repository', value: 'pull' },
  push: { name: 'Push - Push local changes', value: 'push' },
  status: { name: "Status - See what's different", value: 'status' },
  diff: { name: 'Diff - View diff for a file', value: 'diff' },
  config: { name: 'Config - Manage configuration', value: 'config' },
  ignore: { name: 'Ignore - Manage ignore list', value: 'ignore' },
  exit: { name: NAV_LABELS.EXIT, value: NAV_VALUES.EXIT }
};

const baseOptions = { quiet: false };

function buildBackChoice() {
  return { name: NAV_LABELS.BACK, value: NAV_VALUES.BACK };
}

function buildBackExitChoices() {
  return [buildBackChoice(), { name: NAV_LABELS.EXIT, value: NAV_VALUES.EXIT }];
}

async function promptBackOrExit() {
  const { next } = await prompt([
    {
      type: 'select',
      name: 'next',
      message: 'What next?',
      choices: buildBackExitChoices()
    }
  ]);
  return next;
}

async function runAction(choice) {
  switch (choice) {
    case 'pull':
      await syncCommand({ ...baseOptions });
      if ((await promptBackOrExit()) === NAV_VALUES.EXIT) process.exit(0);
      return;
    case 'push':
      await pushCommand({ ...baseOptions, force: false });
      if ((await promptBackOrExit()) === NAV_VALUES.EXIT) process.exit(0);
      return;
    case 'status':
      await statusCommand(baseOptions);
      if ((await promptBackOrExit()) === NAV_VALUES.EXIT) process.exit(0);
      return;
    case 'diff': {
      const { filePath } = await prompt([
        {
          type: 'input',
          name: 'filePath',
          message: 'File path (e.g. rules/foo.mdc):',
          validate: (v) => (v.trim() ? true : 'Path is required')
        }
      ]);
      await diffCommand(filePath.trim(), baseOptions);
      if ((await promptBackOrExit()) === NAV_VALUES.EXIT) process.exit(0);
      return;
    }
    case 'config': {
      while (true) {
        const { scope } = await prompt([
          {
            type: 'select',
            name: 'scope',
            message: 'Config scope:',
            choices: [
              { name: 'Global config', value: 'global' },
              { name: 'Local config (.crules-cli-config.json)', value: 'local' },
              buildBackChoice()
            ]
          }
        ]);
        if (scope === NAV_VALUES.BACK) return;
        const local = scope === 'local';

        while (true) {
          const { action } = await prompt([
            {
              type: 'select',
              name: 'action',
              message: 'Config action:',
              choices: [
                { name: 'List configs', value: 'list' },
                { name: 'Get setting', value: 'get' },
                { name: 'Set setting', value: 'set' },
                { name: 'Create config', value: 'create' },
                { name: 'Use config (switch alias)', value: 'use' },
                buildBackChoice()
              ]
            }
          ]);
          if (action === NAV_VALUES.BACK) break;
          let key, value;
          if (action !== 'list') {
            const keyPrompt = await prompt([
              {
                type: 'input',
                name: 'key',
                message:
                  action === 'use' || action === 'create'
                    ? 'Alias:'
                    : action === 'set'
                      ? 'Key:'
                      : 'Key (leave blank for full config):'
              }
            ]);
            key = keyPrompt.key?.trim();
            if (action === 'set' && key) {
              const valPrompt = await prompt([{ type: 'input', name: 'value', message: 'Value:' }]);
              value = valPrompt.value;
            } else if (action === 'create' && key) {
              const repoPrompt = await prompt([
                {
                  type: 'input',
                  name: 'value',
                  message: 'Repository URL (optional):'
                }
              ]);
              value = repoPrompt.value?.trim() || null;
            }
          }
          const configOptions = { local };
          if (action === 'create' && value) {
            configOptions.repository = value;
          }
          await configCommand(action, key, value, configOptions);
          if ((await promptBackOrExit()) === NAV_VALUES.EXIT) process.exit(0);
        }
      }
      return;
    }
    case 'ignore': {
      while (true) {
        const { action } = await prompt([
          {
            type: 'select',
            name: 'action',
            message: 'Ignore action:',
            choices: [
              { name: 'List', value: 'list' },
              { name: 'Add pattern', value: 'add' },
              { name: 'Remove pattern', value: 'remove' },
              buildBackChoice()
            ]
          }
        ]);
        if (action === NAV_VALUES.BACK) return;
        let pattern;
        if (action !== 'list') {
          const p = await prompt([{ type: 'input', name: 'pattern', message: 'Pattern or path:' }]);
          pattern = p.pattern?.trim();
        }
        await ignoreCommand(action, pattern, {});
        if ((await promptBackOrExit()) === NAV_VALUES.EXIT) process.exit(0);
      }
    }
    case 'exit':
      process.exit(0);
    default:
      return { skipBackPrompt: false };
  }
}

async function runTUI() {
  try {
    await ensureCache(false);
  } catch (err) {
    console.error('\n❌', err.message);
    process.exit(1);
  }

  while (true) {
    const { choice } = await prompt([
      {
        type: 'select',
        name: 'choice',
        message: 'What would you like to do?',
        choices: Object.values(CHOICES)
      }
    ]);

    if (choice === NAV_VALUES.EXIT) {
      process.exit(0);
    }

    try {
      await runAction(choice);
    } catch (err) {
      // Error already displayed by command (loader.fail + suggestions)
    }
  }
}

module.exports = runTUI;
module.exports.runAction = runAction;
