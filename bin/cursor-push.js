#!/usr/bin/env node

const path = require('path');
const {
  getCursorDir,
  ensureCache,
  getAllFiles,
  getFileContent,
  getFileHash,
  promptUser,
  getGitStatus,
  getGitDiff,
  execAsync,
  CURSOR_SOURCE_DIR,
  getProjectSpecificFiles
} = require('../lib/utils');

async function compareFiles() {
  const cursorDir = getCursorDir();
  const projectSpecific = getProjectSpecificFiles(cursorDir);

  // Get all files from current project (excluding project-specific)
  const projectFiles = await getAllFiles(cursorDir);
  const sourceFiles = await getAllFiles(CURSOR_SOURCE_DIR);

  const changes = {
    added: [],
    modified: [],
    deleted: [],
    unchanged: []
  };

  // Check for added/modified files
  for (const [relPath, projectPath] of Object.entries(projectFiles)) {
    // Skip project-specific files
    const fileName = path.basename(relPath);
    const dirName = path.dirname(relPath);
    if (fileName.startsWith('project-')) {
      continue;
    }

    const sourcePath = path.join(CURSOR_SOURCE_DIR, relPath);
    const projectContent = await getFileContent(projectPath);
    const sourceContent = await getFileContent(sourcePath);

    if (!sourceContent) {
      changes.added.push({ path: relPath, content: projectContent });
    } else {
      const projectHash = await getFileHash(projectContent);
      const sourceHash = await getFileHash(sourceContent);
      if (projectHash !== sourceHash) {
        changes.modified.push({ path: relPath, projectContent, sourceContent });
      } else {
        changes.unchanged.push(relPath);
      }
    }
  }

  // Check for deleted files
  for (const [relPath, sourcePath] of Object.entries(sourceFiles)) {
    const fileName = path.basename(relPath);
    if (fileName.startsWith('project-')) {
      continue;
    }

    const projectPath = path.join(cursorDir, relPath);
    const projectContent = await getFileContent(projectPath);
    if (!projectContent) {
      changes.deleted.push({ path: relPath });
    }
  }

  return changes;
}

function displayChanges(changes) {
  console.log('\n📊 Changes detected:\n');

  if (changes.added.length > 0) {
    console.log(`✨ Added (${changes.added.length}):`);
    changes.added.forEach(({ path }) => {
      console.log(`   + ${path}`);
    });
    console.log('');
  }

  if (changes.modified.length > 0) {
    console.log(`📝 Modified (${changes.modified.length}):`);
    changes.modified.forEach(({ path }) => {
      console.log(`   ~ ${path}`);
    });
    console.log('');
  }

  if (changes.deleted.length > 0) {
    console.log(`🗑️  Deleted (${changes.deleted.length}):`);
    changes.deleted.forEach(({ path }) => {
      console.log(`   - ${path}`);
    });
    console.log('');
  }

  if (changes.added.length === 0 && changes.modified.length === 0 && changes.deleted.length === 0) {
    console.log('✅ No changes detected. Everything is up to date!\n');
    return false;
  }

  return true;
}

async function showDiff(changes) {
  if (changes.modified.length === 0) return;

  console.log('\n📋 Detailed changes:\n');
  const MAX_DIFF_LINES = 100;

  for (const { path, projectContent, sourceContent } of changes.modified) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`File: ${path}`);
    console.log('='.repeat(60));

    const projectLines = projectContent.split('\n');
    const sourceLines = sourceContent.split('\n');
    const maxLines = Math.max(projectLines.length, sourceLines.length);
    const diffLines = [];

    for (let i = 0; i < maxLines; i++) {
      const projectLine = projectLines[i] || '';
      const sourceLine = sourceLines[i] || '';

      if (projectLine !== sourceLine) {
        diffLines.push({ line: i + 1, old: sourceLine, new: projectLine });
      }
    }

    if (diffLines.length === 0) {
      console.log('(No differences found)');
      continue;
    }

    if (diffLines.length > MAX_DIFF_LINES) {
      console.log(`⚠️  File has ${diffLines.length} changed lines (showing first ${MAX_DIFF_LINES})...\n`);
    }

    const linesToShow = Math.min(diffLines.length, MAX_DIFF_LINES);
    for (let i = 0; i < linesToShow; i++) {
      const { line, old, new: newLine } = diffLines[i];
      console.log(`Line ${line}:`);
      if (old) console.log(`- ${old}`);
      if (newLine) console.log(`+ ${newLine}`);
      console.log('');
    }

    if (diffLines.length > MAX_DIFF_LINES) {
      console.log(`... (${diffLines.length - MAX_DIFF_LINES} more lines changed)`);
    }
  }
}

async function pushChanges(changes) {
  // Copy changes to cache directory
  const fsPromises = require('fs').promises;
  const { ensureDir } = require('../lib/utils');
  const cursorDir = getCursorDir();

  for (const { path: relPath, content } of changes.added) {
    const destPath = path.join(CURSOR_SOURCE_DIR, relPath);
    await ensureDir(path.dirname(destPath));
    await fsPromises.writeFile(destPath, content, 'utf8');
  }

  for (const { path: relPath, projectContent } of changes.modified) {
    const destPath = path.join(CURSOR_SOURCE_DIR, relPath);
    await fsPromises.writeFile(destPath, projectContent, 'utf8');
  }

  for (const { path: relPath } of changes.deleted) {
    const destPath = path.join(CURSOR_SOURCE_DIR, relPath);
    try {
      await fsPromises.unlink(destPath);
    } catch {
      // File might already be deleted
    }
  }

  // Commit and push
  const { CACHE_DIR } = require('../lib/utils');
  const gitStatus = await getGitStatus(CACHE_DIR);

  if (gitStatus.length === 0) {
    console.log('\n✅ No changes to commit (files already match repository state)');
    return;
  }

  console.log('\n📤 Committing changes...');
  await execAsync('git add .cursor/', { cwd: CACHE_DIR });

  const commitMessage = `Update cursor rules: ${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted`;
  await execAsync(`git commit -m "${commitMessage}"`, { cwd: CACHE_DIR });

  console.log('📤 Pushing to repository...');
  await execAsync('git push', { cwd: CACHE_DIR });

  console.log('\n✅ Changes pushed successfully!');
}

async function push() {
  try {
    console.log('🚀 Preparing to push Cursor Rules changes...\n');

    // Ensure cache is up to date
    await ensureCache();

    // Compare files
    const changes = await compareFiles();

    // Display changes
    const hasChanges = displayChanges(changes);
    if (!hasChanges) {
      return;
    }

    // Show detailed diff for modified files
    const showDetails = await promptUser('\n📋 Show detailed diff? (y/n): ');
    if (showDetails === 'y' || showDetails === 'yes') {
      await showDiff(changes);
    }

    // Confirm push
    const confirm = await promptUser('\n❓ Push these changes to repository? (y/n): ');
    if (confirm !== 'y' && confirm !== 'yes') {
      console.log('\n❌ Push cancelled.');
      return;
    }

    // Push changes
    await pushChanges(changes);

  } catch (error) {
    console.error('\n❌ Error pushing changes:', error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }
}

push();
