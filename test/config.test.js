'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-cli-home-'));
const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'crules-cli-proj-'));

process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;
const prevCwd = process.cwd();
process.chdir(tmpProject);

const config = require('../lib/config.js');

after(() => {
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

test('getActiveScope is global without local config file', () => {
  assert.equal(config.getActiveScope(), 'global');
});

test('getActiveScope is local when local file defines active', () => {
  fs.writeFileSync(
    path.join(tmpProject, '.crules-cli-config.json'),
    JSON.stringify({
      active: 'default',
      configs: { default: { repository: 'https://example.com/a.git' } }
    })
  );
  assert.equal(config.getActiveScope(), 'local');
});

test('setActiveConfig global clears active from local file', () => {
  config.createConfig('proj', { repository: 'https://example.com/r.git' }, false);
  fs.writeFileSync(
    path.join(tmpProject, '.crules-cli-config.json'),
    JSON.stringify({ active: 'default', configs: {} })
  );
  assert.equal(config.getActiveScope(), 'local');
  config.setActiveConfig('proj', false);
  assert.equal(config.getActiveScope(), 'global');
  const raw = JSON.parse(fs.readFileSync(path.join(tmpProject, '.crules-cli-config.json'), 'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(raw, 'active'), false);
});

test('loadGlobalOnlyConfigs does not include profiles only in local file', () => {
  config.createConfig('gonly', { repository: 'https://g.test/repo.git' }, false);
  config.createConfig('lonly', { repository: 'https://l.test/repo.git' }, true);
  const g = config.loadGlobalOnlyConfigs();
  assert.ok(g.configs.gonly);
  assert.equal(g.configs.lonly, undefined);
  const merged = config.getAllConfigs();
  assert.ok(merged.configs.lonly);
});
