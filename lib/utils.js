const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const readline = require('readline');
const minimatch = require('minimatch');
const ora = require('ora').default;
const { getActiveConfig, validateRepository } = require('./config');

const execAsync = promisify(exec);

function getRepoUrl() {
  return getActiveConfig().repository;
}

function getCacheDir() {
  return getActiveConfig().cacheDir;
}

function getSourceDir() {
  const sourcePath = getActiveConfig().sourcePath ?? '.cursor';
  const p = sourcePath || '.';
  return path.join(getCacheDir(), p);
}

function getCursorSourceDir() {
  return getSourceDir();
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

function getIgnoreList() {
  const list = getActiveConfig().ignoreList;
  return Array.isArray(list) ? list : [];
}

function isPathIgnored(relPath, ignoreList) {
  if (!ignoreList || ignoreList.length === 0) return false;
  const list = Array.isArray(ignoreList) ? ignoreList : getIgnoreList();
  const normalizedPath = relPath.replace(/\\/g, '/');
  return list.some(
    pattern =>
      minimatch(normalizedPath, pattern, { matchBase: true }) || minimatch(normalizedPath, pattern)
  );
}

function filterFilesByIgnore(filesObj, ignoreList) {
  const list = ignoreList || getIgnoreList();
  if (list.length === 0) return filesObj;
  const result = {};
  for (const [relPath, fullPath] of Object.entries(filesObj)) {
    if (!isPathIgnored(relPath, list)) result[relPath] = fullPath;
  }
  return result;
}

function pathExists(dirPath) {
  try {
    return fs.existsSync(dirPath);
  } catch {
    return false;
  }
}

function getTargetDir() {
  const targetPath = getActiveConfig().targetPath ?? '.cursor';
  const p = targetPath || '.';
  return path.join(process.cwd(), p);
}

function getCursorDir() {
  return getTargetDir();
}

async function ensureDir(dirPath) {
  if (!pathExists(dirPath)) {
    await fsPromises.mkdir(dirPath, { recursive: true });
  }
}

async function ensureCache(verbose = false, options = {}) {
  const repoUrl = validateRepository();
  const cacheDir = getCacheDir();
  const skipPull = options.skipPull || options.noCacheUpdate || false;

  if (!pathExists(cacheDir)) {
    if (verbose) console.log('📦 Cloning Cursor Rules repository...');
    try {
      await execAsync(`git clone ${repoUrl} "${cacheDir}"`);
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}\nMake sure git is installed and the repository URL is correct.`);
    }
  } else if (!skipPull) {
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

function getProjectSpecificFiles(targetDir) {
  if (!pathExists(targetDir)) {
    return { rules: [], commands: [], docs: [], skills: [], agents: [], hooks: [] };
  }

  const projectSpecific = { rules: [], commands: [], docs: [], skills: [], agents: [], hooks: [] };
  const pattern = getProjectSpecificPattern();

  const dirs = [
    { key: 'rules', ext: '.mdc' },
    { key: 'commands' },
    { key: 'docs' },
    { key: 'skills' },
    { key: 'agents' },
    { key: 'hooks' }
  ];
  for (const { key, ext } of dirs) {
    const dirPath = path.join(targetDir, key);
    if (!pathExists(dirPath)) continue;
    const files = fs.readdirSync(dirPath);
    projectSpecific[key] = files.filter(file =>
      pattern.test(file) && (!ext || file.endsWith(ext))
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

function createOutput(quiet = false) {
  return function log(...args) {
    if (!quiet) console.log(...args);
  };
}

function createLoader(message, quiet = false) {
  if (quiet) return null;
  return ora({ text: message, color: 'cyan' }).start();
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

/**
 * Get relative paths of files that differ between cache HEAD and remote.
 * Returns paths relative to source (e.g. "rules/foo.mdc").
 */
async function getRemoteDiffPaths(cacheDir) {
  const sourcePath = getActiveConfig().sourcePath ?? '.cursor';
  const gitPath = sourcePath || '.';

  try {
    await execAsync('git fetch origin', { cwd: cacheDir });
  } catch {
    return [];
  }

  let remoteRef = 'origin/HEAD';
  try {
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: cacheDir });
    const br = branch.trim();
    if (br && br !== 'HEAD') {
      try {
        await execAsync(`git rev-parse --verify origin/${br}`, { cwd: cacheDir });
        remoteRef = `origin/${br}`;
      } catch {
        /* no upstream branch */
      }
    }
  } catch {
    /* use origin/HEAD */
  }

  try {
    const { stdout } = await execAsync(`git diff --name-only HEAD ${remoteRef} -- "${gitPath}"`, {
      cwd: cacheDir
    });
    const lines = stdout.trim().split('\n').filter(Boolean);
    const prefix = gitPath !== '.' ? new RegExp(`^${gitPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/\\\\]`) : null;
    return lines.map(p => (prefix ? p.replace(prefix, '') : p).replace(/\\/g, '/'));
  } catch {
    return [];
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
  getSourceDir,
  getTargetDir,
  getCursorSourceDir,
  getProjectSpecificPattern,
  getIgnoreList,
  isPathIgnored,
  filterFilesByIgnore,
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
  getRemoteDiffPaths,
  isGitRepo,
  getGitConfigValue,
  setGitConfigValue,
  ensureGitIdentity,
  execAsync,
  createError,
  createOutput,
  createLoader
};
