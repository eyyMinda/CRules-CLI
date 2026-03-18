const path = require('path');
const diff = require('diff');
const {
  getCursorDir,
  ensureCache,
  getFileContent,
  getFileHash,
  getCursorSourceDir,
  createOutput
} = require('../utils');

async function showDiff(filePath, options) {
  const out = createOutput(options.quiet);
  const cursorDir = getCursorDir();
  const projectPath = path.join(cursorDir, filePath);
  const sourcePath = path.join(getCursorSourceDir(), filePath);

  const projectContent = await getFileContent(projectPath);
  const sourceContent = await getFileContent(sourcePath);

  if (!projectContent && !sourceContent) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!projectContent) {
    out(`\n📄 File: ${filePath} (deleted in project)`);
    out('='.repeat(60));
    out(sourceContent);
    return;
  }

  if (!sourceContent) {
    out(`\n📄 File: ${filePath} (new file)`);
    out('='.repeat(60));
    out(projectContent);
    return;
  }

  const projectHash = await getFileHash(projectContent);
  const sourceHash = await getFileHash(sourceContent);

  if (projectHash === sourceHash) {
    out(`✅ File is identical: ${filePath}`);
    return;
  }

  const contextLines = options.verbose ? 3 : 0;
  const patch = diff.createTwoFilesPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    sourceContent,
    projectContent,
    '(source)',
    '(project)',
    { context: contextLines }
  );

  const lines = patch.split('\n');
  const bodyStart = lines.findIndex(l => l.startsWith('@@'));
  const body = bodyStart >= 0 ? lines.slice(bodyStart).join('\n') : patch;

  out(`\n📄 File: ${filePath}`);
  out('='.repeat(60));
  out(body);
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
