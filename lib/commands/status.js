const path = require('path');
const {
  getCursorDir,
  ensureCache,
  getAllFiles,
  getFileContent,
  getFileHash,
  getCursorSourceDir,
  getProjectSpecificFiles,
  filterFilesByIgnore,
  getRemoteDiffPaths,
  getCacheDir,
  createOutput
} = require('../utils');

async function getStatus() {
  const cursorDir = getCursorDir();
  const projectSpecific = getProjectSpecificFiles(cursorDir);
  const sourceDir = getCursorSourceDir();

  const projectFiles = filterFilesByIgnore(await getAllFiles(cursorDir));
  const sourceFiles = filterFilesByIgnore(await getAllFiles(sourceDir));

  const status = {
    added: [],
    modified: [],
    deleted: [],
    outdated: [],
    synced: []
  };

  const { getProjectSpecificPattern } = require('../utils');
  const pattern = getProjectSpecificPattern();

  for (const [relPath, projectPath] of Object.entries(projectFiles)) {
    const fileName = path.basename(relPath);
    if (pattern.test(fileName)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, relPath);
    const projectContent = await getFileContent(projectPath);
    const sourceContent = await getFileContent(sourcePath);

    if (!sourceContent) {
      status.added.push(relPath);
    } else {
      const projectHash = await getFileHash(projectContent);
      const sourceHash = await getFileHash(sourceContent);
      if (projectHash !== sourceHash) {
        status.modified.push(relPath);
      } else {
        status.synced.push(relPath);
      }
    }
  }

  for (const [relPath] of Object.entries(sourceFiles)) {
    const fileName = path.basename(relPath);
    if (pattern.test(fileName)) {
      continue;
    }

    const projectPath = path.join(cursorDir, relPath);
    const projectContent = await getFileContent(projectPath);
    if (!projectContent) {
      status.deleted.push(relPath);
    }
  }

  const cacheDir = getCacheDir();
  const remoteDiffPaths = await getRemoteDiffPaths(cacheDir);
  const remoteDiffSet = new Set(remoteDiffPaths.map(p => p.replace(/\\/g, '/')));

  const trulySynced = [];
  for (const relPath of status.synced) {
    const normalized = relPath.replace(/\\/g, '/');
    if (remoteDiffSet.has(normalized)) {
      status.outdated.push(relPath);
    } else {
      trulySynced.push(relPath);
    }
  }
  status.synced = trulySynced;

  return status;
}

function displayStatus(status, out = console.log) {
  out('\n📊 Cursor Rules Status:\n');

  if (status.added.length > 0) {
    out(`✨ New files (${status.added.length}):`);
    status.added.forEach(file => out(`   + ${file}`));
    out('');
  }

  if (status.modified.length > 0) {
    out(`📝 Modified - local changes (${status.modified.length}):`);
    status.modified.forEach(file => out(`   ~ ${file}`));
    out('');
  }

  if (status.deleted.length > 0) {
    out(`🗑️  Deleted files (${status.deleted.length}):`);
    status.deleted.forEach(file => out(`   - ${file}`));
    out('');
  }

  if (status.outdated.length > 0) {
    out(`⟳  Outdated - remote has updates (${status.outdated.length}):`);
    status.outdated.forEach(file => out(`   ○ ${file}`));
    out('');
  }

  const hasLocalChanges =
    status.added.length > 0 || status.modified.length > 0 || status.deleted.length > 0;
  const hasOutdated = status.outdated.length > 0;

  if (!hasLocalChanges && !hasOutdated) {
    out('✅ Everything is synced!');
    out(`📁 ${status.synced.length} files in sync\n`);
  } else {
    if (hasLocalChanges) {
      out(`💡 Run 'crules push' to push local changes`);
    }
    if (hasOutdated) {
      out(`💡 Run 'crules pull' to get remote updates`);
    }
    out('');
  }
}

async function statusCommand(options) {
  const out = createOutput(options.quiet);
  try {
    await ensureCache(options.verbose && !options.quiet);

    const status = await getStatus();
    displayStatus(status, out);

  } catch (error) {
    console.error('\n❌ Error checking status:', error.message);
    if (error.suggestions) {
      error.suggestions.forEach(suggestion => console.log(`   💡 ${suggestion}`));
    }
    if (options.verbose && error.stderr) {
      console.error(error.stderr);
    }
    throw error;
  }
}

module.exports = statusCommand;
