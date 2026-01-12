#!/usr/bin/env node

const {
  getCursorDir,
  ensureCache,
  getAllFiles,
  getFileContent,
  getFileHash,
  CURSOR_SOURCE_DIR,
  getProjectSpecificFiles
} = require('../lib/utils');

async function getStatus() {
  const cursorDir = getCursorDir();
  const projectSpecific = getProjectSpecificFiles(cursorDir);

  const projectFiles = await getAllFiles(cursorDir);
  const sourceFiles = await getAllFiles(CURSOR_SOURCE_DIR);

  const status = {
    added: [],
    modified: [],
    deleted: [],
    synced: []
  };

  // Check project files
  for (const [relPath, projectPath] of Object.entries(projectFiles)) {
    const fileName = require('path').basename(relPath);
    if (fileName.startsWith('project-')) {
      continue;
    }

    const sourcePath = require('path').join(CURSOR_SOURCE_DIR, relPath);
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

  // Check for deleted files
  for (const [relPath] of Object.entries(sourceFiles)) {
    const fileName = require('path').basename(relPath);
    if (fileName.startsWith('project-')) {
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
    console.log(`💡 Run 'cursor-push' to push these changes to the repository\n`);
  }
}

async function status() {
  try {
    await ensureCache();

    const status = await getStatus();
    displayStatus(status);

  } catch (error) {
    console.error('\n❌ Error checking status:', error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }
}

status();
