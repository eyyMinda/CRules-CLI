const fsPromises = require('fs').promises;
const path = require('path');
const {
  getCursorDir,
  ensureCache,
  getProjectSpecificFiles,
  pathExists,
  ensureDir,
  getCursorSourceDir,
  getIgnoreList,
  isPathIgnored,
  createOutput,
  createLoader
} = require('../utils');
const { getActiveConfig } = require('../config');
const { getStatus } = require('./status');

async function backupProjectSpecific(projectSpecific, targetDir) {
  const backup = {};
  const dirs = ['rules', 'commands', 'docs', 'skills', 'agents', 'hooks'];

  for (const dir of dirs) {
    const files = projectSpecific[dir] || [];
    for (const file of files) {
      const src = path.join(targetDir, dir, file);
      if (pathExists(src)) {
        backup[`${dir}/${file}`] = await fsPromises.readFile(src, 'utf8');
      }
    }
  }

  return backup;
}

async function copyDir(src, dest, excludePattern, sourceRoot = null, ignoreList = null) {
  await ensureDir(dest);
  const list = ignoreList || getIgnoreList();

  const entries = await fsPromises.readdir(src, { withFileTypes: true });
  const root = sourceRoot || src;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (excludePattern && entry.name.match(excludePattern)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, excludePattern, root, list);
    } else {
      const relPath = path.relative(root, srcPath).replace(/\\/g, '/');
      if (list.length > 0 && isPathIgnored(relPath, list)) continue;
      await fsPromises.copyFile(srcPath, destPath);
    }
  }
}

async function restoreProjectSpecific(backup, targetDir) {
  for (const [filePath, content] of Object.entries(backup)) {
    const dest = path.join(targetDir, filePath);
    await ensureDir(path.dirname(dest));
    await fsPromises.writeFile(dest, content, 'utf8');
  }
}

async function syncCommand(options) {
  const out = createOutput(options.quiet);
  const loader = createLoader('Pulling from repository...', options.quiet);
  try {
    const cursorDir = getCursorDir();
    const verbose = options.verbose && !options.quiet;
    const dryRun = options.dryRun || false;

    if (verbose && loader) loader.text = 'Pulling Cursor Rules...';

    const projectSpecific = getProjectSpecificFiles(cursorDir);
    const backup = await backupProjectSpecific(projectSpecific, cursorDir);

    const sourceCursorDir = await ensureCache(verbose, {
      skipPull: options.noCacheUpdate || false
    });

    if (!pathExists(sourceCursorDir)) {
      const sourcePath = getActiveConfig().sourcePath ?? '.cursor';
      throw new Error(`Source directory '${sourcePath}' not found in repository`);
    }

    if (!dryRun) {
      const status = await getStatus();
      if (status.modified.length > 0 && !options.force) {
        const err = new Error(
          `Cannot pull: ${status.modified.length} locally modified file(s) would be overwritten. Use --force to rewrite.`
        );
        err.suggestions = ['crules pull --force'];
        throw err;
      }
    }

    if (dryRun) {
      loader?.stop();
      out('🔍 Dry run mode - no files will be modified\n');
      out(`Would sync from: ${sourceCursorDir}`);
      out(`Would sync to: ${cursorDir}`);
      if (Object.keys(backup).length > 0) {
        out(`Would preserve ${Object.keys(backup).length} project-specific file(s)`);
      }
      return;
    }

    if (verbose && loader) loader.text = 'Copying cursor files...';
    const { getProjectSpecificPattern } = require('../utils');
    const pattern = getProjectSpecificPattern();
    await copyDir(sourceCursorDir, cursorDir, pattern, sourceCursorDir);

    if (Object.keys(backup).length > 0) {
      if (verbose && loader) loader.text = 'Restoring project-specific files...';
      await restoreProjectSpecific(backup, cursorDir);
    }

    loader?.stop();
    out('\n✅ Cursor Rules pulled successfully!');
    out(`📁 Location: ${cursorDir}`);

    if (Object.keys(backup).length > 0) {
      out(`\n💡 Preserved ${Object.keys(backup).length} project-specific file(s)`);
    }

  } catch (error) {
    loader?.fail(error.message);
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
