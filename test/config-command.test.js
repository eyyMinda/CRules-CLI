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
});
