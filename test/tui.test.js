'use strict';

import { spawnSync } from 'child_process';
import path from 'path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('tui', () => {
  it('bin can execute non-tui command paths without loading prompt flow', () => {
    const binPath = path.join(process.cwd(), 'bin', 'crules.js');
    const result = spawnSync(process.execPath, [binPath, '--version'], {
      encoding: 'utf8'
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exports runTUI as default and runAction for tests / tooling', () => {
    const tui = require('../lib/commands/tui.js');
    expect(typeof tui).toBe('function');
    expect(typeof tui.runAction).toBe('function');
  });
});
