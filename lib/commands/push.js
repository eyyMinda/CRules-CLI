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
  createError,
  filterFilesByIgnore,
  createOutput
} = require('../utils');
const { getActiveConfig } = require('../config');

async function compareFiles() {
  const cursorDir = getCursorDir();
  const projectSpecific = getProjectSpecificFiles(cursorDir);
  const sourceDir = getCursorSourceDir();

  const projectFiles = filterFilesByIgnore(await getAllFiles(cursorDir));
  const sourceFiles = filterFilesByIgnore(await getAllFiles(sourceDir));

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

function displayChanges(changes, out = console.log) {
  out('\n📊 Changes detected:\n');

  if (changes.added.length > 0) {
    out(`✨ Added (${changes.added.length}):`);
    changes.added.forEach(({ path }) => {
      out(`   + ${path}`);
    });
    out('');
  }

  if (changes.modified.length > 0) {
    out(`📝 Modified (${changes.modified.length}):`);
    changes.modified.forEach(({ path }) => {
      out(`   ~ ${path}`);
    });
    out('');
  }

  if (changes.deleted.length > 0) {
    out(`🗑️  Deleted (${changes.deleted.length}):`);
    changes.deleted.forEach(({ path }) => {
      out(`   - ${path}`);
    });
    out('');
  }

  if (changes.added.length === 0 && changes.modified.length === 0 && changes.deleted.length === 0) {
    out('✅ No changes detected. Everything is up to date!\n');
    return false;
  }

  return true;
}

async function showDiff(changes, out = console.log) {
  if (changes.modified.length === 0) return;

  out('\n📋 Detailed changes:\n');
  const MAX_DIFF_LINES = 100;

  for (const { path, projectContent, sourceContent } of changes.modified) {
    out(`\n${'='.repeat(60)}`);
    out(`File: ${path}`);
    out('='.repeat(60));

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
      out('(No differences found)');
      continue;
    }

    if (diffLines.length > MAX_DIFF_LINES) {
      out(`⚠️  File has ${diffLines.length} changed lines (showing first ${MAX_DIFF_LINES})...\n`);
    }

    const linesToShow = Math.min(diffLines.length, MAX_DIFF_LINES);
    for (let i = 0; i < linesToShow; i++) {
      const { line, old, new: newLine } = diffLines[i];
      out(`Line ${line}:`);
      if (old) out(`- ${old}`);
      if (newLine) out(`+ ${newLine}`);
      out('');
    }

    if (diffLines.length > MAX_DIFF_LINES) {
      out(`... (${diffLines.length - MAX_DIFF_LINES} more lines changed)`);
    }
  }
}

async function pushToRemote(cacheDir, options = {}) {
  const noPull = options.noPull || false;

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

    if (nonFastForward && noPull) {
      throw createError(
        'Remote has changes. Pull first with crules pull, or run push without --no-pull.',
        [
          'Run: crules pull',
          'Then: crules push',
          'Or remove --no-pull to auto-integrate remote changes'
        ]
      );
    }

    if (nonFastForward) {
      const out = createOutput(options.quiet);
      out('🔄 Remote has changes, pulling latest updates...');
      try {
        await execAsync('git pull --rebase', { cwd: cacheDir });
        out('✅ Successfully integrated remote changes');
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
  const out = createOutput(options.quiet);
  const sourceDir = getCursorSourceDir();
  const cursorDir = getCursorDir();
  const cacheDir = getCacheDir();

  if (options.dryRun) {
    out('\n🔍 Dry run mode - no changes will be pushed\n');
    out(`Would copy ${changes.added.length} added files`);
    out(`Would update ${changes.modified.length} modified files`);
    out(`Would delete ${changes.deleted.length} deleted files`);
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
    out('\n✅ No changes to commit (files already match repository state)');
    return;
  }

  await ensureGitIdentity(cacheDir, process.cwd());

  out('\n📤 Committing changes...');
  const sourcePath = getActiveConfig().sourcePath ?? '.cursor';
  const gitAddPath = sourcePath || '.';
  await execAsync(`git add "${gitAddPath}"`, { cwd: cacheDir });

  const config = getActiveConfig();
  const summary = `${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted`;
  const commitMessage = config.commitMessage.replace('{summary}', summary);

  await execAsync(`git commit -m "${commitMessage}"`, { cwd: cacheDir });

  out('📤 Pushing to repository...');
  await pushToRemote(cacheDir, { noPull: options.noPull, quiet: options.quiet });

  out('\n✅ Changes pushed successfully!');
}

async function pushCommand(options) {
  const out = createOutput(options.quiet);
  try {
    const verbose = options.verbose && !options.quiet;
    const force = options.force || false;
    const dryRun = options.dryRun || false;

    if (verbose) out('🚀 Preparing to push Cursor Rules changes...\n');

    await ensureCache(verbose);

    const changes = await compareFiles();

    const hasChanges = displayChanges(changes, out);
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
        await showDiff(changes, out);
      }

      const confirm = await promptUser('\n❓ Push these changes to repository? (y/n): ', 'n');
      if (confirm !== 'y' && confirm !== 'yes') {
        out('\n❌ Push cancelled.');
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
