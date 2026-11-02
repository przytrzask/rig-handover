import type { DigestRow, Night } from '../digest/types.js';

type Found = Extract<Night, { kind: 'found' }>;

const dash = '—';

function Row({ row }: { row: DigestRow }) {
  const bad = row.retries >= 3 || row.lastStatus === 'fail';
  return (
    <tr>
      <td>{row.job}</td>
      <td>{row.owner ?? dash}</td>
      <td>{row.runs}</td>
      <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
      <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}{bad ? ' ⚠' : ''}</td>
      <td>{row.lastError ?? dash}</td>
      <td>{row.firstAt || dash}</td>
      <td>{row.lastAt || dash}</td>
    </tr>
  );
}

export function DigestView({ night }: { night: Found }) {
  const rows = [...night.rows].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 ? <p class="warn">{night.badLines} bad line(s) skipped</p> : <p class="mute">0 bad lines</p>}
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr><th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last</th><th>error</th><th>first</th><th>last at</th></tr>
          </thead>
          <tbody>{rows.map((r) => <Row row={r} />)}</tbody>
        </table>
      )}
    </>
  );
}
