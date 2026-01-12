const {
  getCursorDir,
  ensureCache,
  getAllFiles,
  getFileContent,
  getFileHash,
  getCursorSourceDir,
  getProjectSpecificFiles
} = require('../utils');

async function getStatus() {
  const cursorDir = getCursorDir();
  const projectSpecific = getProjectSpecificFiles(cursorDir);
  const sourceDir = getCursorSourceDir();

  const projectFiles = await getAllFiles(cursorDir);
  const sourceFiles = await getAllFiles(sourceDir);

  const status = {
    added: [],
    modified: [],
    deleted: [],
    synced: []
  };

  const { getProjectSpecificPattern } = require('../utils');
  const pattern = getProjectSpecificPattern();

  for (const [relPath, projectPath] of Object.entries(projectFiles)) {
    const fileName = require('path').basename(relPath);
    if (pattern.test(fileName)) {
      continue;
    }

    const sourcePath = require('path').join(sourceDir, relPath);
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
    const fileName = require('path').basename(relPath);
    if (pattern.test(fileName)) {
      continue;
    }

    const projectPath = require('path').join(cursorDir, relPath);
    const projectContent = await getFileContent(projectPath);
    if (!projectContent) {
      status.deleted.push(relPath);
    }
  }

  return status;
}

function displayStatus(status) {
  console.log('\n📊 Cursor Rules Status:\n');

  if (status.added.length > 0) {
    console.log(`✨ New files (${status.added.length}):`);
    status.added.forEach(file => console.log(`   + ${file}`));
    console.log('');
  }

  if (status.modified.length > 0) {
    console.log(`📝 Modified files (${status.modified.length}):`);
    status.modified.forEach(file => console.log(`   ~ ${file}`));
    console.log('');
  }

  if (status.deleted.length > 0) {
    console.log(`🗑️  Deleted files (${status.deleted.length}):`);
    status.deleted.forEach(file => console.log(`   - ${file}`));
    console.log('');
  }

  if (status.added.length === 0 && status.modified.length === 0 && status.deleted.length === 0) {
    console.log('✅ Everything is synced!');
    console.log(`📁 ${status.synced.length} files in sync\n`);
  } else {
    console.log(`💡 Run 'crules push' to push these changes to the repository\n`);
  }
}

async function statusCommand(options) {
  try {
    await ensureCache(options.verbose || false);

    const status = await getStatus();
    displayStatus(status);

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
