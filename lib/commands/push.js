const path = require('path');
const diff = require('diff');
const fsPromises = require('fs').promises;
const utils = require('../utils');
const {
  getCursorDir,
  ensureCache,
  getAllFiles,
  getFileContent,
  getFileHash,
  promptUser,
  getGitStatus,
  getCursorSourceDir,
  getProjectSpecificFiles,
  getProjectSpecificPattern,
  ensureDir,
  getCacheDir,
  ensureGitIdentity,
  createError,
  filterFilesByIgnore,
  createOutput,
  createLoader
} = utils;
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

function formatFileDiff(sourceContent, projectContent) {
  const changes = diff.diffLines(sourceContent, projectContent);
  const result = [];
  let oldLine = 1;
  let newLine = 1;
  let removedCount = 0;
  let addedCount = 0;
  let lastLineOutput = 0;
  const sep = '-'.repeat(40);

  for (const part of changes) {
    const lines = part.value.split('\n');
    if (part.value.endsWith('\n')) lines.pop();

    if (part.removed) {
      if (lastLineOutput > 0 && oldLine > lastLineOutput + 1) result.push(sep);
      for (const line of lines) {
        result.push(`${oldLine} -${line}`);
        lastLineOutput = oldLine;
        oldLine++;
        removedCount++;
      }
    } else if (part.added) {
      if (lastLineOutput > 0 && newLine > lastLineOutput + 1) result.push(sep);
      for (const line of lines) {
        result.push(`${newLine} +${line}`);
        lastLineOutput = newLine;
        newLine++;
        addedCount++;
      }
    } else {
      oldLine += lines.length;
      newLine += lines.length;
    }
  }

  const summary = [removedCount && `${removedCount} removed`, addedCount && `${addedCount} added`]
    .filter(Boolean)
    .join(', ');
  return { lines: result, summary };
}

async function showDiff(changes, out = console.log) {
  if (changes.modified.length === 0) return;

  out('📋 Detailed changes:\n');

  for (const { path: filePath, projectContent, sourceContent } of changes.modified) {
    out(`${'='.repeat(60)}`);
    out(`File: ${filePath}`);
    out('='.repeat(60));
    const { lines, summary } = formatFileDiff(sourceContent, projectContent);
    if (summary) out(summary);
    out('(line) - source removed   + project added');

    const MAX_LINES = 80;
    if (lines.length > MAX_LINES) {
      out(lines.slice(0, MAX_LINES).join('\n'));
      out(`... (${lines.length - MAX_LINES} more lines)`);
    } else {
      out(lines.join('\n'));
    }
  }
}

async function pushToRemote(cacheDir, options = {}) {
  const noPull = options.noPull || false;

  try {
    await utils.execAsync('git push', { cwd: cacheDir });
  } catch (error) {
    const combinedOutput = `${error.stdout || ''}\n${error.stderr || ''}`;
    const missingUpstream =
      combinedOutput.includes('no upstream branch') ||
      combinedOutput.includes('set the remote as upstream') ||
      combinedOutput.includes('have no upstream');

    if (missingUpstream) {
      await utils.execAsync('git push -u origin HEAD', { cwd: cacheDir });
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
        await utils.execAsync('git pull --rebase', { cwd: cacheDir });
        out('✅ Successfully integrated remote changes');
        await utils.execAsync('git push', { cwd: cacheDir });
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
        throw createError(`Failed to pull remote changes: ${pullError.message}`, [
          'Check your network connection',
          'Verify repository access permissions',
          'Try manually: git pull (in cache directory)'
        ]);
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
  await utils.execAsync(`git add "${gitAddPath}"`, { cwd: cacheDir });

  const config = getActiveConfig();
  const summary = `${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted`;
  const commitMessage = config.commitMessage.replace('{summary}', summary);

  await utils.execAsync(`git commit -m "${commitMessage}"`, { cwd: cacheDir });

  out('📤 Pushing to repository...');
  await pushToRemote(cacheDir, { noPull: options.noPull, quiet: options.quiet });

  out('\n✅ Changes pushed successfully!');
}

async function pushCommand(options) {
  const out = createOutput(options.quiet);
  const loader = createLoader('Preparing push...', options.quiet);
  try {
    const verbose = options.verbose && !options.quiet;
    const force = options.force || false;
    const dryRun = options.dryRun || false;

    await ensureCache(verbose);

    const changes = await compareFiles();

    loader?.stop();
    const hasChanges = displayChanges(changes, out);
    if (!hasChanges) {
      return;
    }

    if (dryRun) {
      await pushChanges(changes, options);
      return;
    }

    if (!force) {
      const showDetails = await promptUser('📋 Show detailed diff? ', 'n');
      if (showDetails === 'y' || showDetails === 'yes') {
        await showDiff(changes, out);
      }

      const confirm = await promptUser('\n❓ Push these changes to repository? ', 'n');
      if (confirm !== 'y' && confirm !== 'yes') {
        out('\n❌ Push cancelled.');
        return;
      }
    }

    loader?.start('Pushing to repository...');
    await pushChanges(changes, options);
    loader?.stop();
  } catch (error) {
    loader?.fail(error.message);
    console.error('\n❌ Error pushing changes:', error.message);
    if (error.suggestions) {
      error.suggestions.forEach((suggestion) => console.log(`   💡 ${suggestion}`));
    }
    if (verbose && error.stderr) {
      console.error(error.stderr);
    }
    throw error;
  }
}

module.exports = pushCommand;
module.exports.compareFiles = compareFiles;
module.exports.displayChanges = displayChanges;
module.exports.formatFileDiff = formatFileDiff;
module.exports.pushToRemote = pushToRemote;
