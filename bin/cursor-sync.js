#!/usr/bin/env node

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);
const REPO_URL = 'https://github.com/eyyMinda/Cursor-Rules.git';
const CACHE_DIR = path.join(os.homedir(), '.cursor-rules-cache');
const CURSOR_DIR = path.join(process.cwd(), '.cursor');

function pathExists(dirPath) {
  try {
    return fs.existsSync(dirPath);
  } catch {
    return false;
  }
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
    await execAsync('git pull', { cwd: CACHE_DIR });
  }

  return path.join(CACHE_DIR, '.cursor');
}

function getProjectSpecificFiles() {
  if (!pathExists(CURSOR_DIR)) {
    return { rules: [], commands: [] };
  }

  const projectSpecific = { rules: [], commands: [] };

  // Check rules directory
  const rulesDir = path.join(CURSOR_DIR, 'rules');
  if (pathExists(rulesDir)) {
    const files = fs.readdirSync(rulesDir);
    projectSpecific.rules = files.filter(file =>
      file.startsWith('project-') && file.endsWith('.mdc')
    );
  }

  // Check commands directory
  const commandsDir = path.join(CURSOR_DIR, 'commands');
  if (pathExists(commandsDir)) {
    const files = fs.readdirSync(commandsDir);
    projectSpecific.commands = files.filter(file =>
      file.startsWith('project-')
    );
  }

  return projectSpecific;
}

async function backupProjectSpecific(projectSpecific) {
  const backup = {};

  for (const file of projectSpecific.rules) {
    const src = path.join(CURSOR_DIR, 'rules', file);
    if (pathExists(src)) {
      backup[`rules/${file}`] = await fsPromises.readFile(src, 'utf8');
    }
  }

  for (const file of projectSpecific.commands) {
    const src = path.join(CURSOR_DIR, 'commands', file);
    if (pathExists(src)) {
      backup[`commands/${file}`] = await fsPromises.readFile(src, 'utf8');
    }
  }

  return backup;
}

async function copyDir(src, dest, excludePattern) {
  await ensureDir(dest);

  const entries = await fsPromises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip project-specific files from source
    if (excludePattern && entry.name.match(excludePattern)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, excludePattern);
    } else {
      await fsPromises.copyFile(srcPath, destPath);
    }
  }
}

async function restoreProjectSpecific(backup) {
  await ensureDir(path.join(CURSOR_DIR, 'rules'));
  await ensureDir(path.join(CURSOR_DIR, 'commands'));

  for (const [filePath, content] of Object.entries(backup)) {
    const dest = path.join(CURSOR_DIR, filePath);
    await ensureDir(path.dirname(dest));
    await fsPromises.writeFile(dest, content, 'utf8');
  }
}

async function sync() {
  try {
    console.log('🚀 Syncing Cursor Rules...\n');

    // Get project-specific files before sync
    const projectSpecific = getProjectSpecificFiles();
    const backup = await backupProjectSpecific(projectSpecific);

    // Ensure cache is up to date
    const sourceCursorDir = await ensureCache();

    if (!pathExists(sourceCursorDir)) {
      throw new Error('Source .cursor directory not found in repository');
    }

    // Copy everything from repo (excluding project-specific files)
    console.log('📋 Copying rules and commands...');
    await copyDir(sourceCursorDir, CURSOR_DIR, /^project-/);

    // Restore project-specific files
    if (Object.keys(backup).length > 0) {
      console.log('💾 Restoring project-specific files...');
      await restoreProjectSpecific(backup);
    }

    console.log('\n✅ Cursor Rules synced successfully!');
    console.log(`📁 Location: ${CURSOR_DIR}`);

    if (Object.keys(backup).length > 0) {
      console.log(`\n💡 Preserved ${Object.keys(backup).length} project-specific file(s)`);
    }

  } catch (error) {
    console.error('\n❌ Error syncing Cursor Rules:', error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }
}

sync();
