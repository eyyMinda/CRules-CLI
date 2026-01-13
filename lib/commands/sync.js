const fsPromises = require('fs').promises;
const path = require('path');
const {
  getCursorDir,
  ensureCache,
  getProjectSpecificFiles,
  pathExists,
  ensureDir,
  getCursorSourceDir
} = require('../utils');

async function backupProjectSpecific(projectSpecific, cursorDir) {
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

  for (const file of projectSpecific.docs) {
    const src = path.join(cursorDir, 'docs', file);
    if (pathExists(src)) {
      backup[`docs/${file}`] = await fsPromises.readFile(src, 'utf8');
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

async function restoreProjectSpecific(backup, cursorDir) {
  await ensureDir(path.join(cursorDir, 'rules'));
  await ensureDir(path.join(cursorDir, 'commands'));
  await ensureDir(path.join(cursorDir, 'docs'));

  for (const [filePath, content] of Object.entries(backup)) {
    const dest = path.join(cursorDir, filePath);
    await ensureDir(path.dirname(dest));
    await fsPromises.writeFile(dest, content, 'utf8');
  }
}

async function syncCommand(options) {
  try {
    const cursorDir = getCursorDir();
    const verbose = options.verbose || false;
    const dryRun = options.dryRun || false;

    if (verbose) console.log('🚀 Syncing Cursor Rules...\n');

    const projectSpecific = getProjectSpecificFiles(cursorDir);
    const backup = await backupProjectSpecific(projectSpecific, cursorDir);

    const sourceCursorDir = await ensureCache(verbose);

    if (!pathExists(sourceCursorDir)) {
      throw new Error('Source .cursor directory not found in repository');
    }

    if (dryRun) {
      console.log('🔍 Dry run mode - no files will be modified\n');
      console.log(`Would sync from: ${sourceCursorDir}`);
      console.log(`Would sync to: ${cursorDir}`);
      if (Object.keys(backup).length > 0) {
        console.log(`Would preserve ${Object.keys(backup).length} project-specific file(s)`);
      }
      return;
    }

    if (verbose) console.log('📋 Copying cursor files...');
    const { getProjectSpecificPattern } = require('../utils');
    const pattern = getProjectSpecificPattern();
    await copyDir(sourceCursorDir, cursorDir, pattern);

    if (Object.keys(backup).length > 0) {
      if (verbose) console.log('💾 Restoring project-specific files...');
      await restoreProjectSpecific(backup, cursorDir);
    }

    console.log('\n✅ Cursor Rules synced successfully!');
    console.log(`📁 Location: ${cursorDir}`);

    if (Object.keys(backup).length > 0) {
      console.log(`\n💡 Preserved ${Object.keys(backup).length} project-specific file(s)`);
    }

  } catch (error) {
    console.error('\n❌ Error syncing Cursor Rules:', error.message);
    if (error.suggestions) {
      error.suggestions.forEach(suggestion => console.log(`   💡 ${suggestion}`));
    }
    if (options.verbose && error.stderr) {
      console.error(error.stderr);
    }
    throw error;
  }
}

module.exports = syncCommand;
