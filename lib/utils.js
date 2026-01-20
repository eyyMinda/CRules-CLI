const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const readline = require('readline');
const { getActiveConfig, validateRepository } = require('./config');

const execAsync = promisify(exec);

function getRepoUrl() {
  return getActiveConfig().repository;
}

function getCacheDir() {
  return getActiveConfig().cacheDir;
}

function getCursorSourceDir() {
  return path.join(getCacheDir(), '.cursor');
}

function getProjectSpecificPattern() {
  const pattern = getActiveConfig().projectSpecificPattern;
  try {
    return new RegExp(pattern);
  } catch (error) {
    // Fallback to default pattern if regex is invalid
    return /^project-/;
  }
}

function pathExists(dirPath) {
  try {
    return fs.existsSync(dirPath);
  } catch {
    return false;
  }
}

function getCursorDir() {
  return path.join(process.cwd(), '.cursor');
}

async function ensureDir(dirPath) {
  if (!pathExists(dirPath)) {
    await fsPromises.mkdir(dirPath, { recursive: true });
  }
}

async function ensureCache(verbose = false) {
  const repoUrl = validateRepository();
  const cacheDir = getCacheDir();

  if (!pathExists(cacheDir)) {
    if (verbose) console.log('📦 Cloning Cursor Rules repository...');
    try {
      await execAsync(`git clone ${repoUrl} "${cacheDir}"`);
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}\nMake sure git is installed and the repository URL is correct.`);
    }
  } else {
    if (verbose) console.log('🔄 Updating Cursor Rules repository...');
    try {
      await execAsync('git pull', { cwd: cacheDir });
    } catch (error) {
      if (verbose) console.log('⚠️  Pull failed, trying fetch...');
      try {
        await execAsync('git fetch origin', { cwd: cacheDir });
      } catch (fetchError) {
        throw new Error(`Failed to update repository: ${error.message}\nMake sure you have network access and git is properly configured.`);
      }
    }
  }
  return getCursorSourceDir();
}

function getProjectSpecificFiles(cursorDir) {
  if (!pathExists(cursorDir)) {
    return { rules: [], commands: [], docs: [] };
  }

  const projectSpecific = { rules: [], commands: [], docs: [] };
  const pattern = getProjectSpecificPattern();

  const rulesDir = path.join(cursorDir, 'rules');
  if (pathExists(rulesDir)) {
    const files = fs.readdirSync(rulesDir);
    projectSpecific.rules = files.filter(file =>
      pattern.test(file) && file.endsWith('.mdc')
    );
  }

  const commandsDir = path.join(cursorDir, 'commands');
  if (pathExists(commandsDir)) {
    const files = fs.readdirSync(commandsDir);
    projectSpecific.commands = files.filter(file =>
      pattern.test(file)
    );
  }

  const docsDir = path.join(cursorDir, 'docs');
  if (pathExists(docsDir)) {
    const files = fs.readdirSync(docsDir);
    projectSpecific.docs = files.filter(file =>
      pattern.test(file)
    );
  }

  return projectSpecific;
}

async function getAllFiles(dir, baseDir = dir) {
  const files = {};
  if (!pathExists(dir)) return files;

  const entries = await fsPromises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      Object.assign(files, subFiles);
    } else {
      files[relPath] = fullPath;
    }
  }

  return files;
}

async function getFileContent(filePath) {
  try {
    return await fsPromises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function getFileHash(content) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content || '').digest('hex');
}

function promptUser(question, defaultValue = null) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : question;

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

function createError(message, suggestions = []) {
  const error = new Error(message);
  error.suggestions = suggestions;
  return error;
}

async function getGitStatus(cwd) {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd });
    return stdout.trim().split('\n').filter(line => line).map(line => {
      const [status, ...fileParts] = line.trim().split(/\s+/);
      return { status: status.substring(0, 2), file: fileParts.join(' ') };
    });
  } catch {
    return [];
  }
}

async function getGitDiff(cwd, filePath) {
  try {
    const { stdout } = await execAsync(`git diff "${filePath}"`, { cwd });
    return stdout;
  } catch {
    return null;
  }
}

async function isGitRepo(cwd) {
  try {
    const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', { cwd });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function getGitConfigValue(key, options = {}) {
  const args = options.global ? `--global ${key}` : key;
  const execOptions = options.cwd ? { cwd: options.cwd } : undefined;
  try {
    const { stdout } = await execAsync(`git config ${args}`, execOptions);
    const value = stdout.trim();
    return value === '' ? null : value;
  } catch {
    return null;
  }
}

async function setGitConfigValue(key, value, cwd) {
  if (!value) return;
  const quotedValue = JSON.stringify(value);
  await execAsync(`git config ${key} ${quotedValue}`, { cwd });
}

async function ensureGitIdentity(targetCwd, fallbackCwd = null) {
  const targetIsRepo = await isGitRepo(targetCwd);
  if (!targetIsRepo) {
    throw createError(`Cache directory is not a git repository: ${targetCwd}`, [
      'Delete the cache directory and re-run crules sync',
      'Verify your repository URL with crules config get repository'
    ]);
  }

  const [localName, localEmail] = await Promise.all([
    getGitConfigValue('user.name', { cwd: targetCwd }),
    getGitConfigValue('user.email', { cwd: targetCwd })
  ]);

  let resolvedName = localName;
  let resolvedEmail = localEmail;

  if (!resolvedName || !resolvedEmail) {
    const [globalName, globalEmail] = await Promise.all([
      getGitConfigValue('user.name', { global: true }),
      getGitConfigValue('user.email', { global: true })
    ]);
    resolvedName = resolvedName || globalName;
    resolvedEmail = resolvedEmail || globalEmail;
  }

  if ((!resolvedName || !resolvedEmail) && fallbackCwd) {
    const fallbackIsRepo = await isGitRepo(fallbackCwd);
    if (fallbackIsRepo) {
      const [fallbackName, fallbackEmail] = await Promise.all([
        getGitConfigValue('user.name', { cwd: fallbackCwd }),
        getGitConfigValue('user.email', { cwd: fallbackCwd })
      ]);
      resolvedName = resolvedName || fallbackName;
      resolvedEmail = resolvedEmail || fallbackEmail;
    }
  }

  if (!resolvedName || !resolvedEmail) {
    throw createError('Git user.name and user.email are not configured for commits.', [
      'Set global git identity: git config --global user.name "Your Name"',
      'Set global git identity: git config --global user.email "you@example.com"',
      'Or set them in your current repo: git config user.name "Your Name"'
    ]);
  }

  if (!localName) {
    await setGitConfigValue('user.name', resolvedName, targetCwd);
  }
  if (!localEmail) {
    await setGitConfigValue('user.email', resolvedEmail, targetCwd);
  }
}

module.exports = {
  getRepoUrl,
  getCacheDir,
  getCursorSourceDir,
  getProjectSpecificPattern,
  pathExists,
  getCursorDir,
  ensureDir,
  ensureCache,
  getProjectSpecificFiles,
  getAllFiles,
  getFileContent,
  getFileHash,
  promptUser,
  getGitStatus,
  getGitDiff,
  isGitRepo,
  getGitConfigValue,
  setGitConfigValue,
  ensureGitIdentity,
  execAsync,
  createError
};
