const path = require('path');
const fsPromises = require('fs').promises;
const {
  getCursorDir,
  ensureCache,
  getAllFiles,
  getFileContent,
  getFileHash,
  promptUser,
  getGitStatus,
  execAsync,
  getCursorSourceDir,
  getProjectSpecificFiles,
  ensureDir,
  getCacheDir,
  ensureGitIdentity,
  createError
} = require('../utils');
const { getActiveConfig } = require('../config');

async function compareFiles() {
  const cursorDir = getCursorDir();
  const projectSpecific = getProjectSpecificFiles(cursorDir);
  const sourceDir = getCursorSourceDir();

  const projectFiles = await getAllFiles(cursorDir);
  const sourceFiles = await getAllFiles(sourceDir);

  const changes = {
    added: [],
    modified: [],
    deleted: [],
    unchanged: []
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

  for (const [relPath] of Object.entries(sourceFiles)) {
    const fileName = path.basename(relPath);
    if (pattern.test(fileName)) {
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

async function pushToRemote(cacheDir) {
  try {
    await execAsync('git push', { cwd: cacheDir });
  } catch (error) {
    const combinedOutput = `${error.stdout || ''}\n${error.stderr || ''}`;
    const missingUpstream =
      combinedOutput.includes('no upstream branch') ||
      combinedOutput.includes('set the remote as upstream') ||
      combinedOutput.includes('have no upstream');

    if (missingUpstream) {
      await execAsync('git push -u origin HEAD', { cwd: cacheDir });
      return;
    }

    const nonFastForward =
      combinedOutput.includes('non-fast-forward') ||
      combinedOutput.includes('Updates were rejected') ||
      combinedOutput.includes('tip of your current branch is behind');

    if (nonFastForward) {
      console.log('🔄 Remote has changes, pulling latest updates...');
      try {
        await execAsync('git pull --rebase', { cwd: cacheDir });
        console.log('✅ Successfully integrated remote changes');
        await execAsync('git push', { cwd: cacheDir });
      } catch (pullError) {
        const pullOutput = `${pullError.stdout || ''}\n${pullError.stderr || ''}`;
        if (pullOutput.includes('CONFLICT') || pullOutput.includes('conflict')) {
          throw createError(
            'Merge conflict detected. Please resolve conflicts manually in the cache directory and try again.',
            [
              `Cache directory: ${cacheDir}`,
              'Run: git status (in cache directory) to see conflicts',
              'After resolving: git add . && git rebase --continue',
              'Then run: crules push again'
            ]
          );
        }
        throw createError(
          `Failed to pull remote changes: ${pullError.message}`,
          [
            'Check your network connection',
            'Verify repository access permissions',
            'Try manually: git pull (in cache directory)'
          ]
        );
      }
      return;
    }

    throw error;
  }
}

async function pushChanges(changes, options) {
  const sourceDir = getCursorSourceDir();
  const cursorDir = getCursorDir();
  const cacheDir = getCacheDir();

  if (options.dryRun) {
    console.log('\n🔍 Dry run mode - no changes will be pushed\n');
    console.log(`Would copy ${changes.added.length} added files`);
    console.log(`Would update ${changes.modified.length} modified files`);
    console.log(`Would delete ${changes.deleted.length} deleted files`);
    return;
  }

  for (const { path: relPath, content } of changes.added) {
    const destPath = path.join(sourceDir, relPath);
    await ensureDir(path.dirname(destPath));
    await fsPromises.writeFile(destPath, content, 'utf8');
  }

  for (const { path: relPath, projectContent } of changes.modified) {
    const destPath = path.join(sourceDir, relPath);
    await fsPromises.writeFile(destPath, projectContent, 'utf8');
  }

  for (const { path: relPath } of changes.deleted) {
    const destPath = path.join(sourceDir, relPath);
    try {
      await fsPromises.unlink(destPath);
    } catch {
      // File might already be deleted
    }
  }

  const gitStatus = await getGitStatus(cacheDir);

  if (gitStatus.length === 0) {
    console.log('\n✅ No changes to commit (files already match repository state)');
    return;
  }

  await ensureGitIdentity(cacheDir, process.cwd());

  console.log('\n📤 Committing changes...');
  await execAsync('git add .cursor/', { cwd: cacheDir });

  const config = getActiveConfig();
  const summary = `${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted`;
  const commitMessage = config.commitMessage.replace('{summary}', summary);

  await execAsync(`git commit -m "${commitMessage}"`, { cwd: cacheDir });

  console.log('📤 Pushing to repository...');
  await pushToRemote(cacheDir);

  console.log('\n✅ Changes pushed successfully!');
}

async function pushCommand(options) {
  try {
    const verbose = options.verbose || false;
    const force = options.force || false;
    const dryRun = options.dryRun || false;

    if (verbose) console.log('🚀 Preparing to push Cursor Rules changes...\n');

    await ensureCache(verbose);

    const changes = await compareFiles();

    const hasChanges = displayChanges(changes);
    if (!hasChanges) {
      return;
    }

    if (dryRun) {
      await pushChanges(changes, options);
      return;
    }

    if (!force) {
      const showDetails = await promptUser('\n📋 Show detailed diff? (y/n): ', 'n');
      if (showDetails === 'y' || showDetails === 'yes') {
        await showDiff(changes);
      }

      const confirm = await promptUser('\n❓ Push these changes to repository? (y/n): ', 'n');
      if (confirm !== 'y' && confirm !== 'yes') {
        console.log('\n❌ Push cancelled.');
        return;
      }
    }

    await pushChanges(changes, options);

  } catch (error) {
    console.error('\n❌ Error pushing changes:', error.message);
    if (error.suggestions) {
      error.suggestions.forEach(suggestion => console.log(`   💡 ${suggestion}`));
    }
    if (verbose && error.stderr) {
      console.error(error.stderr);
    }
    throw error;
  }
}

module.exports = pushCommand;
