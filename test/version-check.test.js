'use strict';

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { compareSemverGreater } = require('../lib/version-check.js');

describe('version-check', () => {
  it('compareSemverGreater', () => {
    expect(compareSemverGreater('1.2.0', '1.1.9')).toBe(true);
    expect(compareSemverGreater('1.1.9', '1.2.0')).toBe(false);
    expect(compareSemverGreater('1.0.0', '1.0.0')).toBe(false);
    expect(compareSemverGreater('2.0.0', '1.99.99')).toBe(true);
  });
});
