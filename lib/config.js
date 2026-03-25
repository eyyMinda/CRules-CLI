const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI_BASE_DIR = path.join(os.homedir(), '.crules-cli');
const CONFIG_FILE_NAME = '.crules-cli-config.json';
const GLOBAL_CONFIG_PATH = path.join(CLI_BASE_DIR, CONFIG_FILE_NAME);
const LOCAL_CONFIG_PATH = path.join(process.cwd(), CONFIG_FILE_NAME);

const DEFAULT_CONFIG_VALUES = {
  repository: '',
  cacheDir: path.join(CLI_BASE_DIR, 'default'),
  sourcePath: '.cursor',
  targetPath: '.cursor',
  projectSpecificPattern: '^project-',
  commitMessage: 'Update cursor rules: {summary}',
  ignoreList: []
};

function pathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function isValidAlias(alias) {
  return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(alias);
}

function loadConfigFile(configPath) {
  if (!pathExists(configPath)) return null;
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Warning: Could not parse config at ${configPath}: ${error.message}`);
    return null;
  }
}

function localConfigEntryInGitignore(content) {
  const lines = content.split(/\r?\n/);
  return lines.some((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return false;
    return (
      t === CONFIG_FILE_NAME ||
      t === `/${CONFIG_FILE_NAME}` ||
      t.endsWith(`/${CONFIG_FILE_NAME}`)
    );
  });
}

/** Idempotent: ensure root .gitignore contains CRules block + local config filename. */
function ensureCrulesGitignoreEntry() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let content = '';
  if (pathExists(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }
  if (localConfigEntryInGitignore(content)) return;
  const block = `# CRules CLI\n${CONFIG_FILE_NAME}\n`;
  const gap = content.length === 0 ? '' : content.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(gitignorePath, content + gap + block, 'utf8');
}

function saveConfigFile(configPath, configData) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2) + '\n', 'utf8');
    if (configPath === LOCAL_CONFIG_PATH) {
      ensureCrulesGitignoreEntry();
    }
    return true;
  } catch (error) {
    throw new Error(`Failed to write config: ${error.message}`);
  }
}

function normalizeConfigData(configData) {
  if (!configData.configs.default) {
    configData.configs.default = { ...DEFAULT_CONFIG_VALUES };
  }
  for (const alias in configData.configs) {
    const config = configData.configs[alias];
    if (config.cacheDir && config.cacheDir.startsWith('~')) {
      config.cacheDir = config.cacheDir.replace('~', os.homedir());
    }
    if (!Array.isArray(config.ignoreList)) config.ignoreList = [];
    if (config.sourcePath === undefined) config.sourcePath = DEFAULT_CONFIG_VALUES.sourcePath;
    if (config.targetPath === undefined) config.targetPath = DEFAULT_CONFIG_VALUES.targetPath;
    if (alias !== 'default' && !config.cacheDir) {
      config.cacheDir = path.join(CLI_BASE_DIR, alias);
    }
  }
  return configData;
}

function mergeLayerOntoBase(base, layer) {
  if (!layer) return base;
  const next = { ...base, ...layer };
  if (layer.configs) {
    next.configs = { ...base.configs, ...layer.configs };
  }
  return next;
}

/** Defaults + global file only (no project local overlay). */
function loadGlobalOnlyConfigs() {
  let configData = {
    active: 'default',
    configs: { default: { ...DEFAULT_CONFIG_VALUES } }
  };
  const globalConfig = loadConfigFile(GLOBAL_CONFIG_PATH);
  configData = mergeLayerOntoBase(configData, globalConfig);
  return normalizeConfigData(configData);
}

/** Defaults + local file only (no home global overlay). */
function loadLocalOnlyConfigs() {
  let configData = {
    active: 'default',
    configs: { default: { ...DEFAULT_CONFIG_VALUES } }
  };
  const localConfig = loadConfigFile(LOCAL_CONFIG_PATH);
  configData = mergeLayerOntoBase(configData, localConfig);
  return normalizeConfigData(configData);
}

function loadAllConfigs() {
  let configData = {
    active: 'default',
    configs: {
      default: { ...DEFAULT_CONFIG_VALUES }
    }
  };

  const globalConfig = loadConfigFile(GLOBAL_CONFIG_PATH);
  if (globalConfig) {
    configData = { ...configData, ...globalConfig };
    if (globalConfig.configs) {
      configData.configs = { ...configData.configs, ...globalConfig.configs };
    }
  }

  const localConfig = loadConfigFile(LOCAL_CONFIG_PATH);
  if (localConfig) {
    if (localConfig.active !== undefined) configData.active = localConfig.active;
    if (localConfig.configs) {
      configData.configs = { ...configData.configs, ...localConfig.configs };
    }
  }

  return normalizeConfigData(configData);
}

/**
 * Where the effective `active` alias is authored for this project:
 * local file defines `active` → local; otherwise global.
 */
function getActiveScope() {
  const localRaw = loadConfigFile(LOCAL_CONFIG_PATH);
  if (localRaw && Object.prototype.hasOwnProperty.call(localRaw, 'active')) {
    return 'local';
  }
  return 'global';
}

function removeActiveFromLocalConfig() {
  if (!pathExists(LOCAL_CONFIG_PATH)) return;
  const fileConfig = loadConfigFile(LOCAL_CONFIG_PATH);
  if (!fileConfig || !Object.prototype.hasOwnProperty.call(fileConfig, 'active')) return;
  delete fileConfig.active;
  saveConfigFile(LOCAL_CONFIG_PATH, fileConfig);
}

function getTargetConfigPath(local) {
  return local ? LOCAL_CONFIG_PATH : GLOBAL_CONFIG_PATH;
}

function ensureConfigDir(configPath) {
  if (configPath === GLOBAL_CONFIG_PATH && !pathExists(CLI_BASE_DIR)) {
    fs.mkdirSync(CLI_BASE_DIR, { recursive: true });
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
  if (alias) return configData.configs[alias] || null;
  return getActiveConfig();
}

function setActiveConfig(alias, local = false) {
  const configPath = getTargetConfigPath(local);
  const allConfigs = loadAllConfigs();
  if (!allConfigs.configs[alias]) {
    throw new Error(`Config '${alias}' does not exist`);
  }
  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) fileConfig.configs = {};
  fileConfig.active = alias;
  ensureConfigDir(configPath);
  const ok = saveConfigFile(configPath, fileConfig);
  if (!local) {
    removeActiveFromLocalConfig();
  }
  return ok;
}

function createConfig(alias, configData = null, local = false) {
  if (!alias || alias === 'default') {
    throw new Error('Cannot create config with alias "default". Use "default" config or create a named config.');
  }
  if (!isValidAlias(alias)) {
    throw new Error('Invalid alias. Alias must start with a letter and contain only alphanumeric characters, hyphens, and underscores.');
  }
  const configPath = getTargetConfigPath(local);
  const allConfigs = loadAllConfigs();
  if (allConfigs.configs[alias]) {
    throw new Error(`Config '${alias}' already exists`);
  }
  const newConfig = configData || { ...DEFAULT_CONFIG_VALUES };
  if (!newConfig.cacheDir) {
    newConfig.cacheDir = path.join(CLI_BASE_DIR, alias);
  }
  if (newConfig.cacheDir && newConfig.cacheDir.startsWith('~')) {
    newConfig.cacheDir = newConfig.cacheDir.replace('~', os.homedir());
  }
  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) fileConfig.configs = {};
  fileConfig.configs[alias] = newConfig;
  ensureConfigDir(configPath);
  return saveConfigFile(configPath, fileConfig);
}

function deleteConfig(alias, local = false) {
  if (alias === 'default') {
    throw new Error('Cannot delete "default" config');
  }
  const configPath = getTargetConfigPath(local);
  const allConfigs = loadAllConfigs();
  if (!allConfigs.configs[alias]) {
    throw new Error(`Config '${alias}' does not exist`);
  }
  if (allConfigs.active === alias) {
    throw new Error(`Cannot delete active config '${alias}'. Switch to another config first using 'crules config use <alias>'.`);
  }
  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) fileConfig.configs = {};
  delete fileConfig.configs[alias];
  ensureConfigDir(configPath);
  return saveConfigFile(configPath, fileConfig);
}

function renameConfig(oldAlias, newAlias, local = false) {
  if (oldAlias === 'default') {
    throw new Error('Cannot rename "default" config');
  }
  if (!isValidAlias(newAlias)) {
    throw new Error('Invalid alias. Alias must start with a letter and contain only alphanumeric characters, hyphens, and underscores.');
  }
  const configPath = getTargetConfigPath(local);
  const allConfigs = loadAllConfigs();
  if (!allConfigs.configs[oldAlias]) {
    throw new Error(`Config '${oldAlias}' does not exist`);
  }
  if (allConfigs.configs[newAlias]) {
    throw new Error(`Config '${newAlias}' already exists`);
  }
  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) fileConfig.configs = {};
  fileConfig.configs[newAlias] = { ...fileConfig.configs[oldAlias], cacheDir: path.join(CLI_BASE_DIR, newAlias) };
  delete fileConfig.configs[oldAlias];
  if (fileConfig.active === oldAlias) fileConfig.active = newAlias;
  ensureConfigDir(configPath);
  return saveConfigFile(configPath, fileConfig);
}

function updateConfig(alias, key, value, local = false) {
  const configPath = getTargetConfigPath(local);
  const allConfigs = loadAllConfigs();
  const targetAlias = alias || allConfigs.active || 'default';
  if (!allConfigs.configs[targetAlias]) {
    throw new Error(`Config '${targetAlias}' does not exist`);
  }
  const fileConfig = loadConfigFile(configPath) || { configs: {} };
  if (!fileConfig.configs) fileConfig.configs = {};
  if (!fileConfig.configs[targetAlias]) {
    fileConfig.configs[targetAlias] = { ...allConfigs.configs[targetAlias] };
  }
  fileConfig.configs[targetAlias][key] = value;
  if (key === 'cacheDir' && value && value.startsWith('~')) {
    fileConfig.configs[targetAlias][key] = value.replace('~', os.homedir());
  }
  ensureConfigDir(configPath);
  return saveConfigFile(configPath, fileConfig);
}

function getConfigValue(key, alias = null) {
  const config = getConfig(alias);
  return config ? config[key] : undefined;
}

function setConfigValue(key, value, local = false, alias = null) {
  return updateConfig(alias, key, value, local);
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
      '  crules config set repository https://github.com/username/cursor-rules.git'
    );
  }
  return repo;
}

function getConfigFromData(configData, alias) {
  if (alias) return configData.configs[alias] || null;
  const activeName = configData.active || 'default';
  return configData.configs[activeName] || configData.configs.default || { ...DEFAULT_CONFIG_VALUES };
}

function getConfigValueFromData(configData, key, alias = null) {
  const config = getConfigFromData(configData, alias);
  return config ? config[key] : undefined;
}

module.exports = {
  CLI_BASE_DIR,
  CONFIG_FILE_NAME,
  GLOBAL_CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  getAllConfigs,
  loadGlobalOnlyConfigs,
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
  validateRepository,
  isValidAlias,
  DEFAULT_CONFIG: DEFAULT_CONFIG_VALUES
};
