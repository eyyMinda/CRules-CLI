'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-cfgcmd-home-'));
const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-cfgcmd-proj-'));

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
            repository: 'https://example.com/original.git',
            cacheDir: path.join(tmpHome, '.crules-cli', 'default'),
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

function reloadConfigModules() {
  const utilsPath = require.resolve('../lib/utils.js');
  delete require.cache[utilsPath];
  const utils = require(utilsPath);
  if (global.__testPromptUser) {
    utils.promptUser = global.__testPromptUser;
  }
  delete require.cache[require.resolve('../lib/config.js')];
  delete require.cache[require.resolve('../lib/commands/config.js')];
  return {
    config: require('../lib/config.js'),
    configCommand: require('../lib/commands/config.js')
  };
}

afterAll(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
});

let config;
let configCommand;

beforeEach(() => {
  global.__testPromptUser = null;
  wipeConfig();
  writeBaseConfig();
  ({ config, configCommand } = reloadConfigModules());
});

describe('configCommand', () => {
  it('edit updates key via positional key and editValue option', async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await configCommand('edit', 'default', 'repository', {
        quiet: true,
        editValue: 'https://edited-positional.git'
      });
    } finally {
      console.log = orig;
    }
    expect(config.getConfig('default').repository).toBe('https://edited-positional.git');
    expect(logs.some((l) => l.includes('Updated'))).toBe(true);
  });

  it('edit updates key via --key and --value style options', async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await configCommand('edit', 'default', null, {
        quiet: true,
        key: 'repository',
        value: 'https://edited-flags.git'
      });
    } finally {
      console.log = orig;
    }
    expect(config.getConfig('default').repository).toBe('https://edited-flags.git');
  });

  it('set writes a config key on active profile', async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await configCommand('set', 'repository', 'https://via-set.git', { quiet: true });
    } finally {
      console.log = orig;
    }
    expect(config.getConfig('default').repository).toBe('https://via-set.git');
    expect(logs.some((l) => l.includes('Set'))).toBe(true);
  });

  it('use fails for missing alias', async () => {
    const errs = [];
    const orig = console.error;
    console.error = (...a) => errs.push(a.join(' '));
    try {
      await configCommand('use', 'does-not-exist', null, { quiet: true });
    } finally {
      console.error = orig;
    }
    expect(errs.some((e) => e.includes('Failed to switch'))).toBe(true);
  });

  it('create interactive loop retries invalid alias then accepts valid one', async () => {
    const prompts = ['1bad', 'shopify-theme'];
    global.__testPromptUser = async () => prompts.shift() || '';
    ({ config, configCommand } = reloadConfigModules());

    await configCommand('create', null, null, {
      quiet: true,
      repository: 'https://example.com/new.git'
    });

    expect(config.getConfig('shopify-theme')).toMatchObject({
      repository: 'https://example.com/new.git'
    });
  });

  it('create rejects duplicate alias passed directly', async () => {
    const errs = [];
    const origErr = console.error;
    console.error = (...a) => errs.push(a.join(' '));
    try {
      await configCommand('create', 'default', null, { quiet: true });
    } finally {
      console.error = origErr;
    }
    expect(errs.some((e) => e.includes('already exists'))).toBe(true);
  });

  it('create interactive loop retries duplicate alias then accepts valid one', async () => {
    const prompts = ['default', 'shopify-theme'];
    global.__testPromptUser = async () => prompts.shift() || '';
    ({ config, configCommand } = reloadConfigModules());
    await configCommand('create', null, null, { quiet: true, repository: 'x' });
    expect(config.getConfig('shopify-theme')).toMatchObject({ repository: 'x' });
  });

  it('create interactive loop can cancel', async () => {
    global.__testPromptUser = async () => 'cancel';
    ({ config, configCommand } = reloadConfigModules());
    await configCommand('create', null, null, { quiet: true, repository: 'x' });
    expect(config.getConfig('cancel')).toBe(null);
  });
});
