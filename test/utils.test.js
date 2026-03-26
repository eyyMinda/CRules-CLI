'use strict';

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const utils = require('../lib/utils.js');

describe('createError', () => {
  it('attaches suggestions array', () => {
    const err = utils.createError('msg', ['a', 'b']);
    expect(err.message).toBe('msg');
    expect(err.suggestions).toEqual(['a', 'b']);
  });
});

describe('isPathIgnored', () => {
  it('returns false for empty list', () => {
    expect(utils.isPathIgnored('rules/foo.mdc', [])).toBe(false);
    expect(utils.isPathIgnored('rules/foo.mdc', null)).toBe(false);
  });

  it('matches glob patterns', () => {
    expect(utils.isPathIgnored('rules/draft-x.mdc', ['**/draft-*'])).toBe(true);
    expect(utils.isPathIgnored('rules/prod.mdc', ['**/draft-*'])).toBe(false);
  });

  it('normalizes backslashes', () => {
    expect(utils.isPathIgnored('rules\\x.mdc', ['rules/x.mdc'])).toBe(true);
  });
});

describe('filterFilesByIgnore', () => {
  it('returns all files when ignore list empty via explicit []', () => {
    const files = { 'a.mdc': '/a', 'b.tmp': '/b' };
    expect(utils.filterFilesByIgnore(files, [])).toEqual(files);
  });

  it('drops ignored paths for explicit ignore list', () => {
    const files = { 'a.mdc': '/a', 'x.tmp': '/b' };
    const out = utils.filterFilesByIgnore(files, ['*.tmp']);
    expect(out).toEqual({ 'a.mdc': '/a' });
  });
});
