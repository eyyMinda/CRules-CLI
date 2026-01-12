#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');

try {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log(`\n📦 Cursor Rules Sync v${packageJson.version}\n`);
} catch (error) {
  console.log('\n📦 Cursor Rules Sync\n');
}
