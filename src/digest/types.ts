// Plan morning-digest § 1. The contract every part of § 2 codes against.
// Times are kept as the log wrote them (ISO 8601 with its offset); never converted to UTC.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One line of runs/<night>.jsonl, after it parsed. */
export type RunLogLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for the night. */
export type DigestRow = {
  job: string;
  /** Owner on the job's last line (by `at`). `null` stays `null` here; views render it as `—`. */
  owner: string | null;
  /** Lines seen for this job. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  /**
   * Status of the job's last line, ordered by `at` as an instant (offsets compared, not strings);
   * lines with the same instant keep file order.
   */
  lastStatus: RunStatus;
  /**
   * `error` of the job's last line that carried one, if any, even when a later line recovered
   * (so a retried-then-ok job still says why it retried). Absent when no line had an error.
   */
  lastError?: string;
  /** `at` of the job's first and last line, offset kept. */
  firstAt: string;
  lastAt: string;
};

/**
 * The result of reading one night.
 * - `missing`: no runs/<night>.jsonl on disk (routes answer 404).
 * - `found`: the file exists; `rows` may be empty ("nothing ran").
 *   `badLines` counts non-blank lines that are not valid JSON or lack a valid `at`, `job`,
 *   `status` or `owner`; they are never thrown. Blank lines are skipped, not counted.
 * A `night` that is not `YYYY-MM-DD` reads as `missing`.
 */
export type Night =
  | { kind: 'missing'; night: string }
  | { kind: 'found'; night: string; rows: DigestRow[]; badLines: number };

/** Reads runs/<night>.jsonl under `runsDir`. `night` is `YYYY-MM-DD`. */
export type ReadNight = (runsDir: string, night: string) => Night;
