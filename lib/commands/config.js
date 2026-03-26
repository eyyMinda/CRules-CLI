const fs = require('fs');
const {
  CONFIG_FILE_NAME,
  LOCAL_CONFIG_PATH,
  getAllConfigs,
  loadLocalOnlyConfigs,
  getActiveScope,
  getActiveConfigName,
  getActiveConfig,
  getConfig,
  getConfigFromData,
  getConfigValueFromData,
  setActiveConfig,
  createConfig,
  deleteConfig,
  renameConfig,
  updateConfig,
  getConfigValue,
  setConfigValue,
  isValidAlias,
  DEFAULT_CONFIG
} = require('../config');
const { promptUser, createLoader } = require('../utils');

function displayConfig(config, alias = null) {
  const aliasLabel = alias ? ` (${alias})` : '';
  console.log(`\n📋 Configuration${aliasLabel}:\n`);
  for (const [key, value] of Object.entries(config)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('');
}

function displayConfigValue(key, value) {
  console.log(`\n${key}: ${value}\n`);
}

function displayConfigList(configs, activeName) {
  console.log('\n📋 Available Configs:\n');
  for (const [alias, config] of Object.entries(configs)) {
    const activeMarker = alias === activeName ? ' (active)' : '';
    const repo = config.repository || '(not configured)';
    console.log(`  ${alias}${activeMarker}`);
    console.log(`    Repository: ${repo}`);
    console.log(`    Cache Dir: ${config.cacheDir || 'default'}`);
    console.log('');
  }
}

async function configListCommand(options) {
  const local = options.local || false;

  if (local) {
    if (!fs.existsSync(LOCAL_CONFIG_PATH)) {
      console.log(`\nℹ️  No local ${CONFIG_FILE_NAME} in this directory.\n`);
      return;
    }
    if (getActiveScope() === 'global') {
      console.log(
        '\nℹ️  Active config is global; listing local file only (not the active selection for pull/push).\n'
      );
    }
    const data = loadLocalOnlyConfigs();
    const activeName = data.active || 'default';
    displayConfigList(data.configs, activeName);
    console.log(`⚙️  Local file — active alias: ${activeName}`);
    console.log('⚙️  Use crules config use -l <alias> to set active in the local file');
    return;
  }

  const allConfigs = getAllConfigs();
  const activeName = getActiveConfigName();
  const scope = getActiveScope();
  displayConfigList(allConfigs.configs, activeName);
  console.log(`⚙️  Active config: ${activeName} (active scope: ${scope})`);
  console.log(`⚙️  Switch configs using: crules config use <alias>`);
}

async function configGetCommand(key, options) {
  const alias = options.alias || null;
  const local = options.local || false;

  if (local) {
    if (!fs.existsSync(LOCAL_CONFIG_PATH)) {
      console.log(`\nℹ️  No local ${CONFIG_FILE_NAME} in this directory.\n`);
      return;
    }
    if (getActiveScope() === 'global') {
      console.log(
        '\nℹ️  Active config is global; showing local file only (not the active selection for pull/push).\n'
      );
    }
    const data = loadLocalOnlyConfigs();
    if (!key) {
      const config = getConfigFromData(data, alias);
      const displayAlias = alias || data.active || 'default';
      displayConfig(config, displayAlias);
      console.log(`⚙️  Local file only. Omit -l to see merged active config used by pull/push.`);
      console.log(`⚙️  Use 'crules config get <key>' to get a specific value`);
      return;
    }
    const value = getConfigValueFromData(data, key, alias);
    if (value === undefined) {
      console.error(`\n❌ Configuration key '${key}' not found (in local file)`);
      console.log(`\nAvailable keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`);
      return;
    }
    displayConfigValue(key, value);
    return;
  }

  if (!key) {
    const config = getConfig(alias);
    const displayAlias = alias || getActiveConfigName();
    displayConfig(config, displayAlias);
    console.log(`⚙️  Active scope: ${getActiveScope()} (where the active alias is stored)`);
    console.log(`⚙️  Use 'crules config get <key>' to get a specific value`);
    console.log(`⚙️  Use 'crules config set <key> <value>' to set a value`);
    console.log(`⚙️  Use 'crules config get -l' to inspect local file only`);
    return;
  }

  const value = getConfigValue(key, alias);
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

  const local = options.local || false;
  const alias = options.alias || null;

  try {
    setConfigValue(key, value, local, alias);
    const location = local ? 'local' : 'global';
    const configLabel = alias ? `config '${alias}'` : 'active config';
    console.log(`\n✅ Set ${key} = ${value} (${configLabel}, ${location})`);
  } catch (error) {
    console.error(`\n❌ Failed to set config: ${error.message}`);
  }
}

async function configUseCommand(alias, options) {
  if (!alias) {
    console.error('\n❌ Alias is required');
    console.log('Usage: crules config use <alias>');
    return;
  }

  const local = options.local || false;

  try {
    setActiveConfig(alias, local);
    const location = local ? 'local' : 'global';
    console.log(`\n✅ Switched to config '${alias}' (${location})`);

    const config = getConfig(alias);
    const repo = config.repository || '(not configured)';
    console.log(`   Repository: ${repo}`);
  } catch (error) {
    console.error(`\n❌ Failed to switch config: ${error.message}`);
  }
}

async function configCreateCommand(alias, options) {
  if (!alias) {
    console.error('\n❌ Alias is required');
    console.log('Usage: crules config create <alias>');
    console.log('Example: crules config create shopify-theme');
    return;
  }

  if (!isValidAlias(alias)) {
    console.error('\n❌ Invalid alias');
    console.log(
      'Alias must start with a letter and contain only alphanumeric characters, hyphens, and underscores.'
    );
    return;
  }

  const local = options.local || false;

  try {
    // Prompt for repository if not provided
    let repository = options.repository || null;
    if (!repository) {
      repository = await promptUser('Enter repository URL (or press Enter to skip): ');
      if (!repository || repository.trim() === '') {
        repository = '';
      }
    }

    const configData = {
      repository: repository,
      projectSpecificPattern: options.pattern || '^project-',
      commitMessage: options.commitMessage || 'Update cursor rules: {summary}'
    };

    createConfig(alias, configData, local);
    const location = local ? 'local' : 'global';
    console.log(`\n✅ Created config '${alias}' (${location})`);

    if (repository) {
      console.log(`   Repository: ${repository}`);
    } else {
      console.log(
        `   ⚙️  Configure repository using: crules config edit ${alias} repository <url>`
      );
    }
  } catch (error) {
    console.error(`\n❌ Failed to create config: ${error.message}`);
  }
}

async function configDeleteCommand(alias, options) {
  if (!alias) {
    console.error('\n❌ Alias is required');
    console.log('Usage: crules config delete <alias>');
    return;
  }

  if (alias === 'default') {
    console.error('\n❌ Cannot delete "default" config');
    return;
  }

  const local = options.local || false;

  try {
    const confirm = await promptUser(`Are you sure you want to delete config '${alias}'? (y/n): `);
    if (confirm !== 'y' && confirm !== 'yes') {
      console.log('\n❌ Delete cancelled.');
      return;
    }

    deleteConfig(alias, local);
    const location = local ? 'local' : 'global';
    console.log(`\n✅ Deleted config '${alias}' (${location})`);
  } catch (error) {
    console.error(`\n❌ Failed to delete config: ${error.message}`);
  }
}

async function configEditCommand(alias, key, value, options) {
  if (!alias) {
    console.error('\n❌ Alias is required');
    console.log('Usage: crules config edit <alias> <key> <value>');
    console.log('   Or: crules config edit <alias> --key <key> --value <value>');
    console.log(`Available keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`);
    return;
  }

  // Support both formats: edit alias key value OR edit alias --key key --value value
  const configKey = options.key || key;
  const configValue = options.editValue || options.value || value;

  if (!configKey) {
    console.error('\n❌ Key is required');
    console.log('Usage: crules config edit <alias> <key> <value>');
    console.log('   Or: crules config edit <alias> --key <key> --value <value>');
    console.log(`Available keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`);
    return;
  }

  let finalValue = configValue;
  if (!finalValue) {
    finalValue = await promptUser(`Enter value for '${configKey}': `);
    if (!finalValue) {
      console.error('\n❌ Value is required');
      return;
    }
  }

  const local = options.local || false;

  try {
    updateConfig(alias, configKey, finalValue, local);
    const location = local ? 'local' : 'global';
    console.log(`\n✅ Updated ${configKey} = ${finalValue} in config '${alias}' (${location})`);
  } catch (error) {
    console.error(`\n❌ Failed to update config: ${error.message}`);
  }
}

async function configRenameCommand(oldAlias, newAlias, options) {
  if (!oldAlias) {
    console.error('\n❌ Old alias is required');
    console.log('Usage: crules config rename <old-alias> <new-alias>');
    return;
  }

  if (!newAlias) {
    console.error('\n❌ New alias is required');
    console.log('Usage: crules config rename <old-alias> <new-alias>');
    return;
  }

  if (oldAlias === 'default') {
    console.error('\n❌ Cannot rename "default" config');
    return;
  }

  if (!isValidAlias(newAlias)) {
    console.error('\n❌ Invalid new alias');
    console.log(
      'Alias must start with a letter and contain only alphanumeric characters, hyphens, and underscores.'
    );
    return;
  }

  const local = options.local || false;

  try {
    renameConfig(oldAlias, newAlias, local);
    const location = local ? 'local' : 'global';
    console.log(`\n✅ Renamed config '${oldAlias}' to '${newAlias}' (${location})`);
  } catch (error) {
    console.error(`\n❌ Failed to rename config: ${error.message}`);
  }
}

async function configCommand(action, key, value, options) {
  const loader = createLoader('Updating config...', options.quiet);
  try {
    if (action === 'list') {
      await configListCommand(options);
    } else if (action === 'get') {
      await configGetCommand(key, options);
    } else if (action === 'set') {
      await configSetCommand(key, value, options);
    } else if (action === 'use') {
      await configUseCommand(key, options); // key is alias here
    } else if (action === 'create') {
      await configCreateCommand(key, options); // key is alias here
    } else if (action === 'delete') {
      await configDeleteCommand(key, options); // key is alias here
    } else if (action === 'edit') {
      await configEditCommand(key, value, options); // key is alias, value is config key
    } else if (action === 'rename') {
      await configRenameCommand(key, value, options); // key is old alias, value is new alias
    } else {
      console.error(`\n❌ Unknown action: ${action}`);
      console.log('Available actions: list, get, set, use, create, delete, edit, rename');
      console.log('\nExamples:');
      console.log('  crules config list');
      console.log('  crules config get');
      console.log('  crules config get repository');
      console.log('  crules config set repository https://github.com/user/repo.git');
      console.log('  crules config use shopify-theme');
      console.log('  crules config create shopify-theme');
      console.log('  crules config edit shopify-theme repository https://github.com/user/repo.git');
      console.log('  crules config rename shopify-theme shopify-app');
      console.log('  crules config delete shopify-theme');
    }
    loader?.stop();
  } catch (error) {
    loader?.fail(error.message);
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

module.exports = configCommand;
