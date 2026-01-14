const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE_NAME = '.cursor-rules.json';
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), CONFIG_FILE_NAME);
const LOCAL_CONFIG_PATH = path.join(process.cwd(), CONFIG_FILE_NAME);

const DEFAULT_CONFIG_VALUES = {
  repository: '',
  cacheDir: path.join(os.homedir(), '.cursor-rules-cache'),
  projectSpecificPattern: '^project-',
  commitMessage: 'Update cursor rules: {summary}'
};

function pathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function isValidAlias(alias) {
  // Alias must be alphanumeric with hyphens and underscores, not starting with number
  return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(alias);
}

function isOldConfigFormat(config) {
  // Old format has repository, cacheDir, etc. at root level
  // New format has active and configs properties
  return config && !config.configs && (config.repository !== undefined || config.cacheDir !== undefined);
}

function migrateOldConfig(oldConfig) {
  const migrated = {
    active: 'default',
    configs: {
      default: {
        repository: oldConfig.repository || DEFAULT_CONFIG_VALUES.repository,
        cacheDir: oldConfig.cacheDir || DEFAULT_CONFIG_VALUES.cacheDir,
        projectSpecificPattern: oldConfig.projectSpecificPattern || DEFAULT_CONFIG_VALUES.projectSpecificPattern,
        commitMessage: oldConfig.commitMessage || DEFAULT_CONFIG_VALUES.commitMessage
      }
    }
  };

  // Expand ~ in paths
  if (migrated.configs.default.cacheDir && migrated.configs.default.cacheDir.startsWith('~')) {
    migrated.configs.default.cacheDir = migrated.configs.default.cacheDir.replace('~', os.homedir());
  }

  return migrated;
}

function loadConfigFile(configPath) {
  if (!pathExists(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    // Migrate old format if detected
    if (isOldConfigFormat(config)) {
      return migrateOldConfig(config);
    }

    return config;
  } catch (error) {
    console.warn(`⚠️  Warning: Could not parse config at ${configPath}: ${error.message}`);
    return null;
  }
}

function loadAllConfigs() {
  // Start with default structure
  let configData = {
    active: 'default',
    configs: {
      default: { ...DEFAULT_CONFIG_VALUES }
    }
  };

  // Load global config first
  const globalConfig = loadConfigFile(GLOBAL_CONFIG_PATH);
  if (globalConfig) {
    configData = { ...configData, ...globalConfig };
    // Merge configs object
    if (globalConfig.configs) {
      configData.configs = { ...configData.configs, ...globalConfig.configs };
    }
  }

  // Load local config (overrides global)
  const localConfig = loadConfigFile(LOCAL_CONFIG_PATH);
  if (localConfig) {
    // Local active config overrides global
    if (localConfig.active !== undefined) {
      configData.active = localConfig.active;
    }
    // Merge configs object
    if (localConfig.configs) {
      configData.configs = { ...configData.configs, ...localConfig.configs };
    }
  }

  // Ensure default config exists
  if (!configData.configs.default) {
    configData.configs.default = { ...DEFAULT_CONFIG_VALUES };
  }

  // Expand ~ in paths for all configs and set per-config cache dirs
  for (const alias in configData.configs) {
    const config = configData.configs[alias];
    if (config.cacheDir && config.cacheDir.startsWith('~')) {
      config.cacheDir = config.cacheDir.replace('~', os.homedir());
    }
    // Set default cacheDir pattern for non-default configs if not customized
    if (alias !== 'default') {
      const baseCacheDir = configData.configs.default.cacheDir || DEFAULT_CONFIG_VALUES.cacheDir;
      if (!config.cacheDir || config.cacheDir === baseCacheDir) {
        // Only set default pattern if cacheDir is empty or matches base (not customized)
        config.cacheDir = path.join(baseCacheDir, alias);
      }
    }
  }

  return configData;
}

function saveConfigFile(configPath, configData) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write config: ${error.message}`);
  }
}

function getAllConfigs() {
  return loadAllConfigs();
}

function getActiveConfigName() {
  const configData = loadAllConfigs();
  return configData.active || 'default';
}

function getActiveConfig() {
  const configData = loadAllConfigs();
  const activeName = configData.active || 'default';
  return configData.configs[activeName] || configData.configs.default || { ...DEFAULT_CONFIG_VALUES };
}

function getConfig(alias) {
  const configData = loadAllConfigs();
  if (alias) {
    return configData.configs[alias] || null;
  }
  return getActiveConfig();
}

function setActiveConfig(alias, global = false) {
  const configPath = global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
  const configData = loadConfigFile(configPath) || { configs: {} };

  // Validate alias exists
  const allConfigs = loadAllConfigs();
  if (!allConfigs.configs[alias]) {
    throw new Error(`Config '${alias}' does not exist`);
  }

  configData.active = alias;
  if (!configData.configs) {
    configData.configs = {};
  }

  return saveConfigFile(configPath, configData);
}

function createConfig(alias, configData = null, global = false) {
  if (!alias || alias === 'default') {
    throw new Error('Cannot create config with alias "default". Use "default" config or create a named config.');
  }

  if (!isValidAlias(alias)) {
    throw new Error('Invalid alias. Alias must start with a letter and contain only alphanumeric characters, hyphens, and underscores.');
  }

  const configPath = global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
  const allConfigs = loadAllConfigs();

  if (allConfigs.configs[alias]) {
    throw new Error(`Config '${alias}' already exists`);
  }

  const newConfig = configData || { ...DEFAULT_CONFIG_VALUES };

  // Set cacheDir with alias if not provided
  if (!newConfig.cacheDir) {
    const baseCacheDir = allConfigs.configs.default?.cacheDir || DEFAULT_CONFIG_VALUES.cacheDir;
    newConfig.cacheDir = path.join(baseCacheDir, alias);
  }

  // Expand ~ in paths
  if (newConfig.cacheDir && newConfig.cacheDir.startsWith('~')) {
    newConfig.cacheDir = newConfig.cacheDir.replace('~', os.homedir());
  }

  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) {
    fileConfig.configs = {};
  }
  fileConfig.configs[alias] = newConfig;

  return saveConfigFile(configPath, fileConfig);
}

function deleteConfig(alias, global = false) {
  if (alias === 'default') {
    throw new Error('Cannot delete "default" config');
  }

  const configPath = global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
  const allConfigs = loadAllConfigs();

  if (!allConfigs.configs[alias]) {
    throw new Error(`Config '${alias}' does not exist`);
  }

  if (allConfigs.active === alias) {
    throw new Error(`Cannot delete active config '${alias}'. Switch to another config first using 'crules config use <alias>'.`);
  }

  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) {
    fileConfig.configs = {};
  }

  delete fileConfig.configs[alias];

  return saveConfigFile(configPath, fileConfig);
}

function renameConfig(oldAlias, newAlias, global = false) {
  if (oldAlias === 'default') {
    throw new Error('Cannot rename "default" config');
  }

  if (!isValidAlias(newAlias)) {
    throw new Error('Invalid alias. Alias must start with a letter and contain only alphanumeric characters, hyphens, and underscores.');
  }

  const configPath = global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
  const allConfigs = loadAllConfigs();

  if (!allConfigs.configs[oldAlias]) {
    throw new Error(`Config '${oldAlias}' does not exist`);
  }

  if (allConfigs.configs[newAlias]) {
    throw new Error(`Config '${newAlias}' already exists`);
  }

  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) {
    fileConfig.configs = {};
  }

  // Copy config to new alias
  fileConfig.configs[newAlias] = { ...fileConfig.configs[oldAlias] };

  // Update cacheDir if it contains the old alias
  if (fileConfig.configs[newAlias].cacheDir) {
    const baseCacheDir = allConfigs.configs.default?.cacheDir || DEFAULT_CONFIG_VALUES.cacheDir;
    fileConfig.configs[newAlias].cacheDir = path.join(baseCacheDir, newAlias);
  }

  // Delete old alias
  delete fileConfig.configs[oldAlias];

  // Update active if it was the old alias
  if (fileConfig.active === oldAlias) {
    fileConfig.active = newAlias;
  }

  return saveConfigFile(configPath, fileConfig);
}

function updateConfig(alias, key, value, global = false) {
  const configPath = global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
  const allConfigs = loadAllConfigs();
  const targetAlias = alias || allConfigs.active || 'default';

  if (!allConfigs.configs[targetAlias]) {
    throw new Error(`Config '${targetAlias}' does not exist`);
  }

  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) {
    fileConfig.configs = {};
  }

  if (!fileConfig.configs[targetAlias]) {
    // Copy from all configs if not in this file
    fileConfig.configs[targetAlias] = { ...allConfigs.configs[targetAlias] };
  }

  fileConfig.configs[targetAlias][key] = value;

  // Expand ~ in paths
  if (key === 'cacheDir' && value && value.startsWith('~')) {
    fileConfig.configs[targetAlias][key] = value.replace('~', os.homedir());
  }

  return saveConfigFile(configPath, fileConfig);
}

function getConfigValue(key, alias = null) {
  const config = getConfig(alias);
  return config ? config[key] : undefined;
}

function setConfigValue(key, value, global = false, alias = null) {
  return updateConfig(alias, key, value, global);
}

function getConfigPath(global = false) {
  return global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
}

function validateRepository(alias = null) {
  const config = getConfig(alias);
  const repo = config ? config.repository : '';

  if (!repo || repo.trim() === '') {
    const activeName = alias || getActiveConfigName();
    throw new Error(
      `Repository not configured for config '${activeName}'. Please set it using:\n` +
      `  crules config set repository <your-repo-url>\n` +
      `  crules config edit ${activeName} repository <your-repo-url>\n\n` +
      'Example:\n' +
      '  crules config set repository https://github.com/username/cursor-rules.git\n' +
      '  crules config set repository https://github.com/username/cursor-rules.git --global'
    );
  }

  return repo;
}

// Legacy compatibility functions
function loadConfig() {
  return getActiveConfig();
}

module.exports = {
  // New multi-config API
  getAllConfigs,
  getActiveConfigName,
  getActiveConfig,
  getConfig,
  setActiveConfig,
  createConfig,
  deleteConfig,
  renameConfig,
  updateConfig,
  getConfigValue,
  setConfigValue,
  getConfigPath,
  validateRepository,
  isValidAlias,

  // Legacy API (for backward compatibility)
  loadConfig,

  // Constants
  DEFAULT_CONFIG: DEFAULT_CONFIG_VALUES,
  CONFIG_FILE_NAME
};
