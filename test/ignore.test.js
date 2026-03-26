'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-ignore-home-'));
const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-ignore-proj-'));

process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const prevCwd = process.cwd();
process.chdir(tmpProject);

function wipeConfig() {
  const cliDir = path.join(tmpHome, '.crules-cli');
  if (fs.existsSync(cliDir)) fs.rmSync(cliDir, { recursive: true, force: true });
}

function writeBaseConfig() {
  fs.mkdirSync(path.join(tmpHome, '.crules-cli'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpHome, '.crules-cli', '.crules-cli-config.json'),
    JSON.stringify(
      {
        active: 'default',
        configs: {
          default: {
            repository: 'https://example.com/r.git',
            cacheDir: path.join(tmpHome, '.crules-cli', 'default'),
            ignoreList: [],
            projectSpecificPattern: '^project-',
            commitMessage: 'x',
            sourcePath: '.cursor',
            targetPath: '.cursor'
          },
          extra: {
            repository: 'https://example.com/e.git',
            cacheDir: path.join(tmpHome, '.crules-cli', 'extra'),
            ignoreList: [],
            projectSpecificPattern: '^project-',
            commitMessage: 'x',
            sourcePath: '.cursor',
            targetPath: '.cursor'
          }
        }
      },
      null,
      2
    )
  );
}

function reloadModules() {
  delete require.cache[require.resolve('../lib/config.js')];
  delete require.cache[require.resolve('../lib/commands/ignore.js')];
  return {
    config: require('../lib/config.js'),
    ignoreCommand: require('../lib/commands/ignore.js')
  };
}

afterAll(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
});

let config;
let ignoreCommand;

beforeEach(() => {
  wipeConfig();
  writeBaseConfig();
  ({ config, ignoreCommand } = reloadModules());
});

describe('ignoreCommand', () => {
  it('throws when alias does not exist', async () => {
    await expect(ignoreCommand('list', undefined, { quiet: true, alias: 'nope' })).rejects.toThrow(
      "Config 'nope' does not exist"
    );
  });

  it('add then list persists ignoreList on active config', async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await ignoreCommand('add', '*.bak', { quiet: true });
      await ignoreCommand('list', undefined, { quiet: true });
    } finally {
      console.log = orig;
    }
    expect(logs.some((l) => l.includes('*.bak'))).toBe(true);
    const c = config.getConfig(config.getActiveConfigName());
    expect(c.ignoreList).toContain('*.bak');
  });

  it('warns when adding duplicate pattern', async () => {
    await ignoreCommand('add', 'dup.mdc', { quiet: true });
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await ignoreCommand('add', 'dup.mdc', { quiet: true });
    } finally {
      console.log = orig;
    }
    expect(logs.some((l) => l.includes('already in the ignore'))).toBe(true);
  });

  it('remove missing pattern logs warning', async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await ignoreCommand('remove', 'not-there', { quiet: true });
    } finally {
      console.log = orig;
    }
    expect(logs.some((l) => l.includes('not in the ignore'))).toBe(true);
  });

  it('throws on unknown action', async () => {
    await expect(ignoreCommand('nope', 'x', { quiet: true })).rejects.toThrow(/Unknown action/);
  });

  it('throws when add without pattern', async () => {
    await expect(ignoreCommand('add', '', { quiet: true })).rejects.toThrow(
      /Pattern or file path is required/
    );
  });
});
