#!/usr/bin/env node

const path = require('path');
const {
  getCursorDir,
  ensureCache,
  getAllFiles,
  getFileContent,
  getFileHash,
  CURSOR_SOURCE_DIR,
  getProjectSpecificFiles
} = require('../lib/utils');

async function showDiff(filePath) {
  const cursorDir = getCursorDir();
  const projectPath = path.join(cursorDir, filePath);
  const sourcePath = path.join(CURSOR_SOURCE_DIR, filePath);

  const projectContent = await getFileContent(projectPath);
  const sourceContent = await getFileContent(sourcePath);

  if (!projectContent && !sourceContent) {
    console.log(`❌ File not found: ${filePath}`);
    return;
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
      console.log(`  ${projectLine || ''}`);
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

async function diff() {
  try {
    const filePath = process.argv[2];

    if (!filePath) {
      console.error('❌ Please provide a file path');
      console.log('Usage: cursor-diff <file-path>');
      console.log('Example: cursor-diff rules/shopify-reusable-snippets.mdc');
      process.exit(1);
    }

    await ensureCache();
    await showDiff(filePath);

  } catch (error) {
    console.error('\n❌ Error showing diff:', error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }
}

diff();
