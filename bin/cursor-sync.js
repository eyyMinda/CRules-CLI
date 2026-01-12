#!/usr/bin/env node

const fsPromises = require('fs').promises;
const path = require('path');
const {
  getCursorDir,
  ensureCache,
  getProjectSpecificFiles,
  pathExists,
  ensureDir,
  CURSOR_SOURCE_DIR
} = require('../lib/utils');

async function backupProjectSpecific(projectSpecific) {
  const cursorDir = getCursorDir();
  const backup = {};

  for (const file of projectSpecific.rules) {
    const src = path.join(cursorDir, 'rules', file);
    if (pathExists(src)) {
      backup[`rules/${file}`] = await fsPromises.readFile(src, 'utf8');
    }
  }

  for (const file of projectSpecific.commands) {
    const src = path.join(cursorDir, 'commands', file);
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
  const cursorDir = getCursorDir();
  await ensureDir(path.join(cursorDir, 'rules'));
  await ensureDir(path.join(cursorDir, 'commands'));

  for (const [filePath, content] of Object.entries(backup)) {
    const dest = path.join(cursorDir, filePath);
    await ensureDir(path.dirname(dest));
    await fsPromises.writeFile(dest, content, 'utf8');
  }
}

async function sync() {
  try {
    const cursorDir = getCursorDir();
    console.log('🚀 Syncing Cursor Rules...\n');

    // Get project-specific files before sync
    const projectSpecific = getProjectSpecificFiles(cursorDir);
    const backup = await backupProjectSpecific(projectSpecific);

    // Ensure cache is up to date
    await ensureCache();

    if (!pathExists(CURSOR_SOURCE_DIR)) {
      throw new Error('Source .cursor directory not found in repository');
    }

    // Copy everything from repo (excluding project-specific files)
    console.log('📋 Copying rules and commands...');
    await copyDir(CURSOR_SOURCE_DIR, cursorDir, /^project-/);

    // Restore project-specific files
    if (Object.keys(backup).length > 0) {
      console.log('💾 Restoring project-specific files...');
      await restoreProjectSpecific(backup);
    }

    console.log('\n✅ Cursor Rules synced successfully!');
    console.log(`📁 Location: ${cursorDir}`);

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
