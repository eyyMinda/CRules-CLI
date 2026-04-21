'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-status-home-'));
const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-status-proj-'));
const tmpCache = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-status-cache-'));

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
          repository: 'https://example.com/crules-fixture.git',
          cacheDir: tmpCache,
          sourcePath: '.cursor',
          targetPath: '.cursor',
          projectSpecificPattern: '^project-',
          commitMessage: 'Update cursor rules: {summary}',
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
const { getStatus } = require('../lib/commands/status.js');

const projCursor = path.join(tmpProject, '.cursor');
const cacheCursor = path.join(tmpCache, '.cursor');

function wipeCursorTrees() {
  for (const root of [projCursor, cacheCursor]) {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

afterAll(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
  fs.rmSync(tmpCache, { recursive: true, force: true });
});

beforeEach(() => {
  wipeCursorTrees();
  vi.spyOn(utils, 'getRemoteDiffPaths').mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** getStatus uses path.relative; on Windows rel paths use backslashes. */
function norm(p) {
  return p.replace(/\\/g, '/');
}

describe('getStatus', () => {
  it('classifies file only in project as added', async () => {
    writeFile(path.join(projCursor, 'rules/new.mdc'), 'only here');

    const s = await getStatus();
    expect(s.added.map(norm)).toContain('rules/new.mdc');
    expect(s.modified).toHaveLength(0);
    expect(s.deleted).toHaveLength(0);
    expect(s.synced).toHaveLength(0);
    expect(s.outdated).toHaveLength(0);
  });

  it('classifies file only in source cache as deleted', async () => {
    writeFile(path.join(cacheCursor, 'rules/gone.mdc'), 'remote only');

    const s = await getStatus();
    expect(s.deleted.map(norm)).toContain('rules/gone.mdc');
    expect(s.added).toHaveLength(0);
  });

  it('classifies hash mismatch as modified', async () => {
    writeFile(path.join(projCursor, 'rules/x.mdc'), 'local');
    writeFile(path.join(cacheCursor, 'rules/x.mdc'), 'remote');

    const s = await getStatus();
    expect(s.modified.map(norm)).toContain('rules/x.mdc');
    expect(s.synced).toHaveLength(0);
  });

  it('classifies matching content as synced when not in remote diff', async () => {
    writeFile(path.join(projCursor, 'rules/same.mdc'), 'identical');
    writeFile(path.join(cacheCursor, 'rules/same.mdc'), 'identical');

    const s = await getStatus();
    expect(s.synced.map(norm)).toContain('rules/same.mdc');
    expect(s.outdated).toHaveLength(0);
  });

  it('moves synced file to outdated when path is in remote diff', async () => {
    writeFile(path.join(projCursor, 'rules/same.mdc'), 'identical');
    writeFile(path.join(cacheCursor, 'rules/same.mdc'), 'identical');
    utils.getRemoteDiffPaths.mockResolvedValue(['rules/same.mdc']);

    const s = await getStatus();
    expect(s.outdated.map(norm)).toContain('rules/same.mdc');
    expect(s.synced).toHaveLength(0);
  });

  it('normalizes backslashes in remote diff paths', async () => {
    writeFile(path.join(projCursor, 'rules/same.mdc'), 'identical');
    writeFile(path.join(cacheCursor, 'rules/same.mdc'), 'identical');
    utils.getRemoteDiffPaths.mockResolvedValue(['rules\\same.mdc']);

    const s = await getStatus();
    expect(s.outdated.map(norm)).toContain('rules/same.mdc');
  });

  it('skips project-specific files by basename and path segment', async () => {
    writeFile(path.join(projCursor, 'rules/project-local.mdc'), 'x');
    writeFile(path.join(projCursor, 'skills/project-local/SKILL.md'), 'x');
    writeFile(path.join(projCursor, 'rules/normal.mdc'), 'a');
    writeFile(path.join(cacheCursor, 'rules/normal.mdc'), 'b');

    const s = await getStatus();
    expect(s.added).not.toContain('rules/project-local.mdc');
    expect(s.added).not.toContain('skills/project-local/SKILL.md');
    expect(s.modified).not.toContain('rules/project-local.mdc');
    expect(s.modified.map(norm)).toContain('rules/normal.mdc');
  });
});
