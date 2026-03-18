const path = require('path');
const diff = require('diff');
const {
  getCursorDir,
  ensureCache,
  getFileContent,
  getFileHash,
  getCursorSourceDir,
  createOutput,
  createLoader
} = require('../utils');

async function showDiff(filePath, options) {
  const out = createOutput(options.quiet);
  const loader = createLoader('Loading diff...', options.quiet);
  try {
    const cursorDir = getCursorDir();
    const projectPath = path.join(cursorDir, filePath);
    const sourcePath = path.join(getCursorSourceDir(), filePath);

    const projectContent = await getFileContent(projectPath);
    const sourceContent = await getFileContent(sourcePath);

    if (!projectContent && !sourceContent) {
    throw new Error(`File not found: ${filePath}`);
    }

    if (!projectContent) {
      loader?.stop();
      out(`\n📄 File: ${filePath} (deleted in project)`);
      out('='.repeat(60));
      out(sourceContent);
      return;
    }

    if (!sourceContent) {
      loader?.stop();
      out(`\n📄 File: ${filePath} (new file)`);
      out('='.repeat(60));
      out(projectContent);
      return;
    }

    const projectHash = await getFileHash(projectContent);
    const sourceHash = await getFileHash(sourceContent);

    if (projectHash === sourceHash) {
      loader?.stop();
      out(`✅ File is identical: ${filePath}`);
      return;
    }

    const contextLines = options.verbose ? 3 : 0;
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
        for (const line of lines) {
          if (contextLines > 0) {
            result.push(`${oldLine}  ${line}`);
          }
          oldLine++;
          newLine++;
        }
      }
    }

    const summary = [removedCount && `${removedCount} removed`, addedCount && `${addedCount} added`].filter(Boolean).join(', ');
    loader?.stop();
    out(`\n📄 File: ${filePath}`);
    out('='.repeat(60));
    if (summary) out(summary);
    out('(line) - source removed   + project added');
    out(result.join('\n'));
  } catch (error) {
    loader?.fail(error.message);
    throw error;
  }
}

async function diffCommand(filePath, options) {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    await ensureCache(options.verbose && !options.quiet);
    await showDiff(filePath, options);
  } catch (error) {
    console.error('\n❌ Error showing diff:', error.message);
    if (error.suggestions) {
      error.suggestions.forEach(suggestion => console.log(`   💡 ${suggestion}`));
    }
    if (options.verbose && error.stderr) {
      console.error(error.stderr);
    }
    throw error;
  }
}

module.exports = diffCommand;
