'use strict';

import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const utils = require('../lib/utils.js');
const { pushToRemote, displayChanges, formatFileDiff } = require('../lib/commands/push.js');

beforeEach(() => {
  vi.spyOn(utils, 'execAsync').mockResolvedValue({ stdout: '', stderr: '' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('displayChanges', () => {
  it('returns false when no added, modified, or deleted', () => {
    const logs = [];
    const r = displayChanges({ added: [], modified: [], deleted: [], unchanged: [] }, (m) =>
      logs.push(m)
    );
    expect(r).toBe(false);
    expect(logs.some((l) => String(l).includes('No changes'))).toBe(true);
  });

  it('returns true when there are changes', () => {
    const r = displayChanges(
      { added: [{ path: 'a.mdc' }], modified: [], deleted: [], unchanged: [] },
      () => {}
    );
    expect(r).toBe(true);
  });
});

describe('formatFileDiff', () => {
  it('returns line markers for simple line diff', () => {
    const { lines, summary } = formatFileDiff('a\n', 'b\n');
    expect(summary).toMatch(/removed|added/);
    expect(lines.some((l) => l.includes('-'))).toBe(true);
    expect(lines.some((l) => l.includes('+'))).toBe(true);
  });
});

describe('pushToRemote', () => {
  it('succeeds on first git push', async () => {
    await pushToRemote('/cache', {});
    expect(utils.execAsync).toHaveBeenCalledWith('git push', { cwd: '/cache' });
  });

  it('retries with upstream when no upstream branch', async () => {
    utils.execAsync
      .mockRejectedValueOnce(Object.assign(new Error('fail'), { stderr: 'no upstream branch' }))
      .mockResolvedValueOnce({ stdout: '', stderr: '' });
    await pushToRemote('/cache', {});
    expect(utils.execAsync).toHaveBeenCalledTimes(2);
    expect(utils.execAsync).toHaveBeenLastCalledWith('git push -u origin HEAD', { cwd: '/cache' });
  });

  it('throws with suggestions when non-fast-forward and noPull', async () => {
    utils.execAsync.mockRejectedValue(
      Object.assign(new Error('fail'), { stderr: 'Updates were rejected (non-fast-forward)' })
    );
    await expect(pushToRemote('/cache', { noPull: true })).rejects.toMatchObject({
      message: expect.stringContaining('Remote has changes'),
      suggestions: expect.arrayContaining([expect.stringContaining('crules pull')])
    });
  });

  it('pull --rebase then push on non-fast-forward', async () => {
    utils.execAsync
      .mockRejectedValueOnce(Object.assign(new Error('fail'), { stderr: 'Updates were rejected' }))
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });
    await pushToRemote('/cache', { noPull: false, quiet: true });
    expect(utils.execAsync).toHaveBeenCalledWith('git pull --rebase', { cwd: '/cache' });
    expect(utils.execAsync).toHaveBeenLastCalledWith('git push', { cwd: '/cache' });
  });

  it('throws createError on rebase conflict', async () => {
    utils.execAsync
      .mockRejectedValueOnce(Object.assign(new Error('fail'), { stderr: 'non-fast-forward' }))
      .mockRejectedValueOnce(
        Object.assign(new Error('pull fail'), { stderr: 'CONFLICT (content)' })
      );
    await expect(pushToRemote('/cache', { quiet: true })).rejects.toMatchObject({
      message: expect.stringContaining('Merge conflict'),
      suggestions: expect.arrayContaining([expect.stringContaining('Cache directory')])
    });
  });

  it('rethrows unrelated push errors', async () => {
    const err = Object.assign(new Error('network down'), { stderr: 'fatal: unable' });
    utils.execAsync.mockRejectedValue(err);
    await expect(pushToRemote('/cache', {})).rejects.toThrow('network down');
  });
});
