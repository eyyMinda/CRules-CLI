const path = require('path');
const {
  getCursorDir,
  ensureCache,
  getFileContent,
  getFileHash,
  getCursorSourceDir
} = require('../utils');

async function showDiff(filePath, options) {
  const cursorDir = getCursorDir();
  const projectPath = path.join(cursorDir, filePath);
  const sourcePath = path.join(getCursorSourceDir(), filePath);

  const projectContent = await getFileContent(projectPath);
  const sourceContent = await getFileContent(sourcePath);

  if (!projectContent && !sourceContent) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!projectContent) {
    console.log(`\n📄 File: ${filePath} (deleted in project)`);
    console.log('='.repeat(60));
    console.log(sourceContent);
    return;
  }

  if (!sourceContent) {
    console.log(`\n📄 File: ${filePath} (new file)`);
    console.log('='.repeat(60));
    console.log(projectContent);
    return;
  }

  const projectHash = await getFileHash(projectContent);
  const sourceHash = await getFileHash(sourceContent);

  if (projectHash === sourceHash) {
    console.log(`✅ File is identical: ${filePath}`);
    return;
  }

  console.log(`\n📄 File: ${filePath}`);
  console.log('='.repeat(60));

  const projectLines = projectContent.split('\n');
  const sourceLines = sourceContent.split('\n');
  const maxLines = Math.max(projectLines.length, sourceLines.length);

  for (let i = 0; i < maxLines; i++) {
    const projectLine = projectLines[i];
    const sourceLine = sourceLines[i];

    if (projectLine === sourceLine) {
      if (options.verbose) {
        console.log(`  ${projectLine || ''}`);
      }
    } else {
      if (sourceLine !== undefined) {
        console.log(`- ${sourceLine}`);
      }
      if (projectLine !== undefined) {
        console.log(`+ ${projectLine}`);
      }
    }
  }
}

async function diffCommand(filePath, options) {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    await ensureCache(options.verbose || false);
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
