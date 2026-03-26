'use strict';

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('tui', () => {
  it('exports runTUI as default and runAction for tests / tooling', () => {
    const tui = require('../lib/commands/tui.js');
    expect(typeof tui).toBe('function');
    expect(typeof tui.runAction).toBe('function');
  });
});
