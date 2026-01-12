const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const readline = require('readline');

const execAsync = promisify(exec);

const REPO_URL = 'https://github.com/eyyMinda/Cursor-Rules.git';
const CACHE_DIR = path.join(os.homedir(), '.cursor-rules-cache');
const CURSOR_SOURCE_DIR = path.join(CACHE_DIR, '.cursor');

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

async function ensureCache() {
  if (!pathExists(CACHE_DIR)) {
    console.log('📦 Cloning Cursor Rules repository...');
    await execAsync(`git clone ${REPO_URL} "${CACHE_DIR}"`);
  } else {
    console.log('🔄 Updating Cursor Rules repository...');
    try {
      await execAsync('git pull', { cwd: CACHE_DIR });
    } catch (error) {
      // If pull fails, try fetch and reset (for force updates)
      console.log('⚠️  Pull failed, trying fetch...');
      await execAsync('git fetch origin', { cwd: CACHE_DIR });
    }
  }
  return CURSOR_SOURCE_DIR;
}

function getProjectSpecificFiles(cursorDir) {
  if (!pathExists(cursorDir)) {
    return { rules: [], commands: [] };
  }

  const projectSpecific = { rules: [], commands: [] };

  const rulesDir = path.join(cursorDir, 'rules');
  if (pathExists(rulesDir)) {
    const files = fs.readdirSync(rulesDir);
    projectSpecific.rules = files.filter(file =>
      file.startsWith('project-') && file.endsWith('.mdc')
    );
  }

  const commandsDir = path.join(cursorDir, 'commands');
  if (pathExists(commandsDir)) {
    const files = fs.readdirSync(commandsDir);
    projectSpecific.commands = files.filter(file =>
      file.startsWith('project-')
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

function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
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

module.exports = {
  REPO_URL,
  CACHE_DIR,
  CURSOR_SOURCE_DIR,
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
  execAsync
};
