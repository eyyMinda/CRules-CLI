const { getConfig, getConfigValue, setConfigValue, getConfigPath, DEFAULT_CONFIG } = require('../config');
const { promptUser } = require('../utils');

function displayConfig(config) {
  console.log('\n📋 Current Configuration:\n');
  for (const [key, value] of Object.entries(config)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('');
}

function displayConfigValue(key, value) {
  console.log(`\n${key}: ${value}\n`);
}

async function configGetCommand(key, options) {
  if (!key) {
    const config = getConfig();
    displayConfig(config);
    console.log(`💡 Use 'crules config get <key>' to get a specific value`);
    console.log(`💡 Use 'crules config set <key> <value>' to set a value`);
    return;
  }

  const value = getConfigValue(key);
  if (value === undefined) {
    console.error(`\n❌ Configuration key '${key}' not found`);
    console.log(`\nAvailable keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`);
    return;
  }

  displayConfigValue(key, value);
}

async function configSetCommand(key, value, options) {
  if (!key) {
    console.error('\n❌ Key is required');
    console.log('Usage: crules config set <key> <value>');
    console.log(`Available keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`);
    return;
  }

  if (!value) {
    value = await promptUser(`Enter value for '${key}': `);
    if (!value) {
      console.error('\n❌ Value is required');
      return;
    }
  }

  const global = options.global || false;

  try {
    setConfigValue(key, value, global);
    const location = global ? 'global' : 'local';
    console.log(`\n✅ Set ${key} = ${value} (${location} config)`);
  } catch (error) {
    console.error(`\n❌ Failed to set config: ${error.message}`);
  }
}

async function configCommand(action, key, value, options) {
  try {
    if (action === 'get') {
      await configGetCommand(key, options);
    } else if (action === 'set') {
      await configSetCommand(key, value, options);
    } else {
      console.error(`\n❌ Unknown action: ${action}`);
      console.log('Available actions: get, set');
      console.log('\nExamples:');
      console.log('  crules config get');
      console.log('  crules config get repository');
      console.log('  crules config set repository https://github.com/user/repo.git');
      console.log('  crules config set repository https://github.com/user/repo.git --global');
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

module.exports = configCommand;
