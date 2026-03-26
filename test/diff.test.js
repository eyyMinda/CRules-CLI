'use strict';

import path from 'path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

function isUnder(p, segment) {
  return path.normalize(p).replace(/\\/g, '/').includes(segment);
}

const utils = require('../lib/utils.js');
const diffCommand = require('../lib/commands/diff.js');

function md5(s) {
  return crypto
    .createHash('md5')
    .update(s || '')
    .digest('hex');
}

beforeEach(() => {
  vi.spyOn(utils, 'ensureCache').mockResolvedValue(undefined);
  vi.spyOn(utils, 'getCursorDir').mockReturnValue('/proj/.cursor');
  vi.spyOn(utils, 'getCursorSourceDir').mockReturnValue('/cache/.cursor');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('diffCommand', () => {
  it('throws when file path is missing', async () => {
    await expect(diffCommand('', { quiet: true })).rejects.toThrow('File path is required');
  });

  it('throws when neither project nor source has the file', async () => {
    vi.spyOn(utils, 'getFileContent').mockResolvedValue(null);
    await expect(diffCommand('rules/missing.mdc', { quiet: true })).rejects.toThrow(
      'File not found: rules/missing.mdc'
    );
  });

  it('prints source-only as deleted in project', async () => {
    const lines = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => lines.push(a.join(' ')));
    vi.spyOn(utils, 'getFileContent').mockImplementation(async (p) => {
      if (isUnder(p, 'cache')) return 'only-remote';
      return null;
    });
    try {
      await diffCommand('rules/x.mdc', { quiet: false });
    } finally {
      vi.mocked(console.log).mockRestore();
    }
    expect(lines.some((l) => l.includes('deleted in project'))).toBe(true);
    expect(lines.some((l) => l.includes('only-remote'))).toBe(true);
  });

  it('prints project-only as new file', async () => {
    const lines = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => lines.push(a.join(' ')));
    vi.spyOn(utils, 'getFileContent').mockImplementation(async (p) => {
      if (isUnder(p, 'proj')) return 'only-local';
      return null;
    });
    try {
      await diffCommand('rules/y.mdc', { quiet: false });
    } finally {
      vi.mocked(console.log).mockRestore();
    }
    expect(lines.some((l) => l.includes('new file'))).toBe(true);
    expect(lines.some((l) => l.includes('only-local'))).toBe(true);
  });

  it('reports identical when hashes match', async () => {
    const lines = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => lines.push(a.join(' ')));
    vi.spyOn(utils, 'getFileContent').mockResolvedValue('same');
    vi.spyOn(utils, 'getFileHash').mockImplementation(async (c) => md5(c));
    try {
      await diffCommand('rules/z.mdc', { quiet: false });
    } finally {
      vi.mocked(console.log).mockRestore();
    }
    expect(lines.some((l) => l.includes('identical'))).toBe(true);
  });

  it('prints diff hunks when content differs', async () => {
    const lines = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => lines.push(a.join(' ')));
    vi.spyOn(utils, 'getFileContent').mockImplementation(async (p) => {
      if (isUnder(p, 'proj')) return 'B';
      return 'A';
    });
    vi.spyOn(utils, 'getFileHash').mockImplementation(async (c) => md5(c));
    try {
      await diffCommand('rules/diff.mdc', { quiet: false });
    } finally {
      vi.mocked(console.log).mockRestore();
    }
    const big = lines.join('\n');
    expect(big).toMatch(/-|\+/);
    expect(big).toContain('(line) - source removed');
  });

  it('verbose includes context lines in diff output', async () => {
    const lines = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => lines.push(a.join(' ')));
    vi.spyOn(utils, 'getFileContent').mockImplementation(async (p) => {
      if (isUnder(p, 'proj')) return 'line2\nline3';
      return 'line1\nline2\nline3';
    });
    vi.spyOn(utils, 'getFileHash').mockImplementation(async (c) => md5(c));
    try {
      await diffCommand('rules/ctx.mdc', { quiet: false, verbose: true });
    } finally {
      vi.mocked(console.log).mockRestore();
    }
    const joined = lines.join('\n');
    expect(joined).toMatch(/\d+\s+line2/);
  });
});
