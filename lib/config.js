const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE_NAME = '.cursor-rules.json';
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), CONFIG_FILE_NAME);
const LOCAL_CONFIG_PATH = path.join(process.cwd(), CONFIG_FILE_NAME);

const DEFAULT_CONFIG = {
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

function loadConfig() {
  let config = { ...DEFAULT_CONFIG };

  // Load global config first
  if (pathExists(GLOBAL_CONFIG_PATH)) {
    try {
      const globalConfig = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
      config = { ...config, ...globalConfig };
    } catch (error) {
      console.warn(`⚠️  Warning: Could not parse global config: ${error.message}`);
    }
  }

  // Load local config (overrides global)
  if (pathExists(LOCAL_CONFIG_PATH)) {
    try {
      const localConfig = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
      config = { ...config, ...localConfig };
    } catch (error) {
      console.warn(`⚠️  Warning: Could not parse local config: ${error.message}`);
    }
  }

  // Expand ~ in paths
  if (config.cacheDir && config.cacheDir.startsWith('~')) {
    config.cacheDir = config.cacheDir.replace('~', os.homedir());
  }

  return config;
}

function getConfig() {
  return loadConfig();
}

function getConfigValue(key) {
  const config = loadConfig();
  return config[key];
}

function setConfigValue(key, value, global = false) {
  const configPath = global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
  let config = {};

  if (pathExists(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      config = {};
    }
  }

  config[key] = value;

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write config: ${error.message}`);
  }
}

function getConfigPath(global = false) {
  return global ? GLOBAL_CONFIG_PATH : LOCAL_CONFIG_PATH;
}

function validateRepository() {
  const config = loadConfig();
  const repo = config.repository;

  if (!repo || repo.trim() === '') {
    throw new Error(
      'Repository not configured. Please set it using:\n' +
      '  crules config set repository <your-repo-url>\n\n' +
      'Example:\n' +
      '  crules config set repository https://github.com/username/cursor-rules.git\n' +
      '  crules config set repository https://github.com/username/cursor-rules.git --global'
    );
  }

  return repo;
}

module.exports = {
  getConfig,
  getConfigValue,
  setConfigValue,
  getConfigPath,
  validateRepository,
  DEFAULT_CONFIG,
  CONFIG_FILE_NAME
};
