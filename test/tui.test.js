'use strict';

import { spawnSync } from 'child_process';
import path from 'path';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const inquirerPath = require.resolve('inquirer');

beforeEach(() => {
  vi.restoreAllMocks();
  delete require.cache[inquirerPath];
  delete require.cache[require.resolve('../lib/commands/tui.js')];
});

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

  it('prefers default.createPromptModule when both exist', () => {
    const sentinelPrompt = async () => ({});
    require.cache[inquirerPath] = {
      exports: {
        createPromptModule: () => {
          throw new Error('root createPromptModule should not be used');
        },
        default: {
          createPromptModule: () => sentinelPrompt
        }
      }
    };

    const tui = require('../lib/commands/tui.js');
    expect(typeof tui).toBe('function');
  });

  it('uses select prompts instead of removed list alias', () => {
    const tuiPath = require.resolve('../lib/commands/tui.js');
    const source = require('fs').readFileSync(tuiPath, 'utf8');
    expect(source.includes("type: 'list'")).toBe(false);
    expect(source.includes("type: 'select'")).toBe(true);
  });
});
