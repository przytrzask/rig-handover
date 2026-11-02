import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { Night } from '../src/digest/types.js';

function found(n: Night) {
  if (n.kind !== 'found') throw new Error(`expected found, got ${n.kind}`);
  return n;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = found(readNight('runs', '2026-10-28'));

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds each job into one row', () => {
    const byJob = Object.fromEntries(night.rows.map((r) => [r.job, r]));
    expect(byJob['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['lane/sync']).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(byJob['notes/backup']).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['rig/rotate-logs']).toMatchObject({ owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok' });
    expect(byJob['rig/rotate-logs']).not.toHaveProperty('lastError');
  });

  it('keeps a null owner', () => {
    const row = night.rows.find((r) => r.job === 'digest/render');
    expect(row).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });
});

describe('readNight on a temp runs dir', () => {
  let dir = '';
  const write = (name: string, body: string) => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, name), body);
  };
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('a night with no file is missing', () => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    expect(readNight(dir, '2026-01-01')).toEqual({ kind: 'missing', night: '2026-01-01' });
  });

  it('a runs dir that does not exist is missing', () => {
    expect(readNight(join(tmpdir(), 'rig-no-such-dir-xyz'), '2026-01-01').kind).toBe('missing');
  });

  it('a night that is not YYYY-MM-DD is missing', () => {
    expect(readNight('runs', '../package').kind).toBe('missing');
  });

  it('an empty file is found with no rows', () => {
    write('2026-01-01.jsonl', '');
    expect(readNight(dir, '2026-01-01')).toEqual({ kind: 'found', night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('blank lines are skipped; invalid shapes are counted, never thrown', () => {
    write(
      '2026-01-01.jsonl',
      [
        '',
        '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":null}',
        '   ',
        '[]',
        '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"weird","owner":"x"}',
        '{"at":"not a time","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok"}',
        'nope',
        '',
      ].join('\n'),
    );
    const n = found(readNight(dir, '2026-01-01'));
    expect(n.badLines).toBe(5);
    expect(n.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        firstAt: '2026-01-01T01:00:00+01:00',
        lastAt: '2026-01-01T01:00:00+01:00',
      },
    ]);
  });

  it('orders lines by instant, not by string, and keeps the offset', () => {
    write(
      '2026-01-01.jsonl',
      [
        // 01:30+01:00 is 00:30Z; 00:45Z is later though its string sorts first.
        '{"at":"2026-01-01T01:30:00+01:00","job":"a","status":"retry","owner":"x","error":"e1"}',
        '{"at":"2026-01-01T00:45:00Z","job":"a","status":"fail","owner":null,"error":"e2"}',
        '{"at":"2026-01-01T00:00:00Z","job":"a","status":"ok","owner":"x"}',
      ].join('\n'),
    );
    const [row] = found(readNight(dir, '2026-01-01')).rows;
    expect(row).toEqual({
      job: 'a',
      owner: null,
      runs: 3,
      retries: 1,
      lastStatus: 'fail',
      lastError: 'e2',
      firstAt: '2026-01-01T00:00:00Z',
      lastAt: '2026-01-01T00:45:00Z',
    });
  });
});
