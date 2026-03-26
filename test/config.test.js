'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-cli-home-'));
const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-cli-proj-'));

process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;
const prevCwd = process.cwd();
process.chdir(tmpProject);

const config = require('../lib/config.js');

afterAll(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
});

function wipeState() {
  const cliDir = path.join(tmpHome, '.crules-cli');
  if (fs.existsSync(cliDir)) fs.rmSync(cliDir, { recursive: true, force: true });
  const lc = path.join(tmpProject, '.crules-cli-config.json');
  if (fs.existsSync(lc)) fs.unlinkSync(lc);
}

beforeEach(() => wipeState());

describe('config', () => {
  it('getActiveScope is global without local config file', () => {
    expect(config.getActiveScope()).toBe('global');
  });

  it('getActiveScope is local when local file defines active', () => {
    fs.writeFileSync(
      path.join(tmpProject, '.crules-cli-config.json'),
      JSON.stringify({
        active: 'default',
        configs: { default: { repository: 'https://example.com/a.git' } }
      })
    );
    expect(config.getActiveScope()).toBe('local');
  });

  it('setActiveConfig global clears active from local file', () => {
    config.createConfig('proj', { repository: 'https://example.com/r.git' }, false);
    fs.writeFileSync(
      path.join(tmpProject, '.crules-cli-config.json'),
      JSON.stringify({ active: 'default', configs: {} })
    );
    expect(config.getActiveScope()).toBe('local');
    config.setActiveConfig('proj', false);
    expect(config.getActiveScope()).toBe('global');
    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpProject, '.crules-cli-config.json'), 'utf8')
    );
    expect(Object.prototype.hasOwnProperty.call(raw, 'active')).toBe(false);
  });

  it('loadGlobalOnlyConfigs does not include profiles only in local file', () => {
    config.createConfig('gonly', { repository: 'https://g.test/repo.git' }, false);
    config.createConfig('lonly', { repository: 'https://l.test/repo.git' }, true);
    const g = config.loadGlobalOnlyConfigs();
    expect(g.configs.gonly).toBeTruthy();
    expect(g.configs.lonly).toBeUndefined();
    const merged = config.getAllConfigs();
    expect(merged.configs.lonly).toBeTruthy();
  });
});
