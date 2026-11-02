import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLogLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parses one log line; `null` when it isn't a valid run line. Never throws. */
export function parseLine(text: string): RunLogLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  const { at, job, status, owner, error } = v;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const line: RunLogLine = { at, job, status: status as RunStatus, owner };
  if (error !== undefined) line.error = error;
  return line;
}

/** Folds parsed lines into one row per job, sorted by job. */
export function toRows(lines: RunLogLine[]): DigestRow[] {
  const byJob = new Map<string, RunLogLine[]>();
  for (const l of lines) {
    const list = byJob.get(l.job);
    if (list) list.push(l);
    else byJob.set(l.job, [l]);
  }
  const rows: DigestRow[] = [];
  for (const [job, list] of byJob) {
    // Order by instant (offsets may differ between lines); a stable sort keeps file order on ties.
    const ordered = [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const withError = ordered.filter((l) => l.error !== undefined);
    const row: DigestRow = {
      job,
      owner: last.owner,
      runs: ordered.length,
      retries: ordered.filter((l) => l.status === 'retry').length,
      lastStatus: last.status,
      firstAt: first.at,
      lastAt: last.at,
    };
    const lastError = withError[withError.length - 1]?.error;
    if (lastError !== undefined) row.lastError = lastError;
    rows.push(row);
  }
  return rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}

export const readNight: ReadNight = (runsDir: string, night: string): Night => {
  // Only YYYY-MM-DD names a night; anything else (e.g. `../x`) is not on disk.
  if (!NIGHT.test(night)) return { kind: 'missing', night };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if (isRecord(e) && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { kind: 'missing', night };
    throw e;
  }
  const lines: RunLogLine[] = [];
  let badLines = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue; // blank lines (trailing newline) are not lines
    const line = parseLine(raw);
    if (line) lines.push(line);
    else badLines++;
  }
  return { kind: 'found', night, rows: toRows(lines), badLines };
};
