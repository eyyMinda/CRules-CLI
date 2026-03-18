const { getConfig, updateConfig, getActiveConfigName, getAllConfigs } = require('../config');

function getTargetConfig(options) {
  const alias = options.alias || getActiveConfigName();
  const allConfigs = getAllConfigs();
  if (!allConfigs.configs[alias]) {
    throw new Error(`Config '${alias}' does not exist`);
  }
  return alias;
}

function getIgnoreListForConfig(alias) {
  const config = getConfig(alias);
  const list = config?.ignoreList;
  return Array.isArray(list) ? [...list] : [];
}

async function ignoreAddCommand(pattern, options) {
  if (!pattern || !pattern.trim()) {
    throw new Error('Pattern or file path is required. Usage: crules ignore add <pattern|file>');
  }

  const trimmed = pattern.trim();
  const alias = getTargetConfig(options);
  const list = getIgnoreListForConfig(alias);

  if (list.includes(trimmed)) {
    console.log(`\n⚠️  '${trimmed}' is already in the ignore list\n`);
    return;
  }

  list.push(trimmed);
  updateConfig(alias, 'ignoreList', list, options.global || false);
  const location = options.global ? 'global' : 'local';
  console.log(`\n✅ Added '${trimmed}' to ignore list (${alias}, ${location})\n`);
}

async function ignoreRemoveCommand(pattern, options) {
  if (!pattern || !pattern.trim()) {
    throw new Error('Pattern or file path is required. Usage: crules ignore remove <pattern|file>');
  }

  const trimmed = pattern.trim();
  const alias = getTargetConfig(options);
  const list = getIgnoreListForConfig(alias);

  const idx = list.indexOf(trimmed);
  if (idx === -1) {
    console.log(`\n⚠️  '${trimmed}' is not in the ignore list\n`);
    return;
  }

  list.splice(idx, 1);
  updateConfig(alias, 'ignoreList', list, options.global || false);
  const location = options.global ? 'global' : 'local';
  console.log(`\n✅ Removed '${trimmed}' from ignore list (${alias}, ${location})\n`);
}

async function ignoreListCommand(options) {
  const alias = getTargetConfig(options);
  const list = getIgnoreListForConfig(alias);
  const location = options.global ? 'global' : 'local';

  console.log(`\n📋 Ignore list (${alias}, ${location}):\n`);
  if (list.length === 0) {
    console.log('  (empty)\n');
    return;
  }
  list.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
  console.log('');
}

async function ignoreCommand(action, pattern, options) {
  try {
    const alias = options.alias || getActiveConfigName();
    options.alias = alias;

    switch (action) {
      case 'add':
        await ignoreAddCommand(pattern, options);
        break;
      case 'remove':
        await ignoreRemoveCommand(pattern, options);
        break;
      case 'list':
        await ignoreListCommand(options);
        break;
      default:
        throw new Error(
          `Unknown action '${action}'. Use: add, remove, list\n` +
            'Examples:\n' +
            '  crules ignore add "*.bak"\n' +
            '  crules ignore add rules/draft-*.mdc\n' +
            '  crules ignore remove "*.bak"\n' +
            '  crules ignore list'
        );
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

module.exports = ignoreCommand;
