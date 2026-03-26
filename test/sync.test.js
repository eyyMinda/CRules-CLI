'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-sync-home-'));
const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-sync-proj-'));

process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

fs.mkdirSync(path.join(tmpHome, '.crules-cli'), { recursive: true });
fs.writeFileSync(
  path.join(tmpHome, '.crules-cli', '.crules-cli-config.json'),
  JSON.stringify(
    {
      active: 'default',
      configs: {
        default: {
          repository: 'https://example.com/crules-sync.git',
          cacheDir: path.join(tmpHome, '.crules-cli', 'default'),
          sourcePath: '.cursor',
          targetPath: '.cursor',
          projectSpecificPattern: '^project-',
          commitMessage: 'x',
          ignoreList: []
        }
      }
    },
    null,
    2
  )
);

const prevCwd = process.cwd();
process.chdir(tmpProject);

const utils = require('../lib/utils.js');
const statusMod = require('../lib/commands/status.js');
const syncCommand = require('../lib/commands/sync.js');

const emptyProjectSpecific = {
  rules: [],
  commands: [],
  docs: [],
  skills: [],
  agents: [],
  hooks: []
};

afterAll(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
});

beforeEach(() => {
  vi.spyOn(utils, 'getCursorDir').mockReturnValue(path.join(tmpProject, '.cursor'));
  vi.spyOn(utils, 'getProjectSpecificFiles').mockReturnValue(emptyProjectSpecific);
  vi.spyOn(utils, 'ensureCache').mockResolvedValue(path.join(tmpProject, 'cache-src', '.cursor'));
  vi.spyOn(utils, 'pathExists').mockReturnValue(true);
  vi.spyOn(utils, 'getProjectSpecificPattern').mockReturnValue(/^project-/);
  vi.spyOn(statusMod, 'getStatus').mockResolvedValue({
    added: [],
    modified: [],
    deleted: [],
    outdated: [],
    synced: []
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('syncCommand (pull)', () => {
  it('dry run does not call getStatus and returns after messaging', async () => {
    const spy = vi.spyOn(statusMod, 'getStatus');
    await syncCommand({ dryRun: true, quiet: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it('throws when source cursor dir is missing in cache', async () => {
    utils.pathExists.mockImplementation((p) => {
      if (String(p).includes('cache-src')) return false;
      return true;
    });
    await expect(syncCommand({ quiet: true })).rejects.toThrow(
      /Source directory '\.cursor' not found/
    );
  });

  it('throws with suggestions when local modified files and no force', async () => {
    statusMod.getStatus.mockResolvedValue({
      added: [],
      modified: ['rules/x.mdc'],
      deleted: [],
      outdated: [],
      synced: []
    });
    await expect(syncCommand({ quiet: true })).rejects.toMatchObject({
      message: expect.stringContaining('Cannot pull'),
      suggestions: ['crules pull --force']
    });
  });

  it('does not throw for modified check when force is true', async () => {
    statusMod.getStatus.mockResolvedValue({
      added: [],
      modified: ['rules/x.mdc'],
      deleted: [],
      outdated: [],
      synced: []
    });
    const srcRoot = path.join(tmpProject, 'cache-src', '.cursor');
    const destRoot = path.join(tmpProject, '.cursor');
    fs.mkdirSync(path.join(srcRoot, 'rules'), { recursive: true });
    fs.writeFileSync(path.join(srcRoot, 'rules', 'a.mdc'), 'x', 'utf8');
    fs.mkdirSync(path.join(destRoot, 'rules'), { recursive: true });

    await syncCommand({ quiet: true, force: true });
    expect(fs.existsSync(path.join(destRoot, 'rules', 'a.mdc'))).toBe(true);
  });
});
