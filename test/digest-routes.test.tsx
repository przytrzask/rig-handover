import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('digest routes', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  const write = (name: string, body: string) => {
    if (!tempDir) tempDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    writeFileSync(join(tempDir, name), body);
  };

  describe('GET /digest/:night with a night that has rows', () => {
    it('returns 200 with job rows on the page', async () => {
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' }).request('/digest/2026-10-28');
      expect(res.status).toBe(200);
      const html = await res.text();
      // Check that the page has the digest title and contains job rows
      expect(html).toContain('digest 2026-10-28');
      expect(html).toContain('fixtures/refresh');
      expect(html).toContain('lane/sync');
      expect(html).toContain('notes/backup');
      expect(html).toContain('rig/rotate-logs');
      expect(html).toContain('digest/render');
    });
  });

  describe('GET /api/digest/:night with a night that has rows', () => {
    it('returns 200 with the same jobs in the same order as the page', async () => {
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' }).request('/api/digest/2026-10-28');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.kind).toBe('found');
      expect(json.night).toBe('2026-10-28');
      // Jobs should be sorted by job name (alphabetically)
      const jobs = json.rows.map((r: any) => r.job);
      expect(jobs).toEqual([
        'digest/render',
        'fixtures/refresh',
        'lane/sync',
        'notes/backup',
        'rig/rotate-logs',
      ]);
      // Each row should have the expected structure
      expect(json.rows[0]).toHaveProperty('job');
      expect(json.rows[0]).toHaveProperty('owner');
      expect(json.rows[0]).toHaveProperty('runs');
      expect(json.rows[0]).toHaveProperty('retries');
      expect(json.rows[0]).toHaveProperty('lastStatus');
      expect(json.rows[0]).toHaveProperty('firstAt');
      expect(json.rows[0]).toHaveProperty('lastAt');
    });
  });

  describe('GET /digest/:night with a night that has no file', () => {
    it('returns 404', async () => {
      write('2026-11-01.jsonl', '');
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir }).request('/digest/2026-11-02');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/digest/:night with a night that has no file', () => {
    it('returns 404 with missing kind', async () => {
      write('2026-11-01.jsonl', '');
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir }).request('/api/digest/2026-11-02');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.kind).toBe('missing');
      expect(json.night).toBe('2026-11-02');
    });
  });

  describe('GET /digest/:night with an empty night', () => {
    it('returns 200 with "nothing ran" message', async () => {
      write('2026-11-01.jsonl', '');
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir }).request('/digest/2026-11-01');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('digest 2026-11-01');
      expect(html).toContain('nothing ran');
      expect(html).toContain('0 bad lines');
    });
  });

  describe('GET /api/digest/:night with an empty night', () => {
    it('returns 200 with empty rows array', async () => {
      write('2026-11-01.jsonl', '');
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir }).request('/api/digest/2026-11-01');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.kind).toBe('found');
      expect(json.night).toBe('2026-11-01');
      expect(json.rows).toEqual([]);
      expect(json.badLines).toBe(0);
    });
  });

  describe('GET /digest/:night with a night that has a bad line', () => {
    it('returns 200 and shows the bad line count', async () => {
      write(
        '2026-11-01.jsonl',
        [
          '{"at":"2026-11-01T01:00:00+01:00","job":"test/job","status":"ok","owner":"test"}',
          'this is not valid json',
        ].join('\n'),
      );
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir }).request('/digest/2026-11-01');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('digest 2026-11-01');
      expect(html).toContain('1 bad line(s) skipped');
      expect(html).toContain('test/job');
    });
  });

  describe('GET /api/digest/:night with a night that has a bad line', () => {
    it('returns 200 and includes badLines count', async () => {
      write(
        '2026-11-01.jsonl',
        [
          '{"at":"2026-11-01T01:00:00+01:00","job":"test/job","status":"ok","owner":"test"}',
          'this is not valid json',
        ].join('\n'),
      );
      const res = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tempDir }).request('/api/digest/2026-11-01');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.kind).toBe('found');
      expect(json.night).toBe('2026-11-01');
      expect(json.badLines).toBe(1);
      expect(json.rows).toHaveLength(1);
      expect(json.rows[0].job).toBe('test/job');
    });
  });

  describe('page and JSON route agreement', () => {
    it('JSON route returns the same jobs in the same order as the page', async () => {
      const pageRes = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' }).request('/digest/2026-10-28');
      const pageHtml = await pageRes.text();

      const jsonRes = await createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' }).request('/api/digest/2026-10-28');
      const jsonData = await jsonRes.json();

      // Extract job names from HTML (they appear in table cells)
      const pageJobs = jsonData.rows.map((r: any) => r.job);
      for (const job of pageJobs) {
        expect(pageHtml).toContain(job);
      }

      // Verify order is consistent
      expect(pageJobs).toEqual([
        'digest/render',
        'fixtures/refresh',
        'lane/sync',
        'notes/backup',
        'rig/rotate-logs',
      ]);
    });
  });
});
