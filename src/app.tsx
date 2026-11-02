import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { readNight } from './digest/read.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (night.kind === 'missing') {
      return c.json({ kind: 'missing', night: night.night }, 404);
    }
    return c.json({
      kind: 'found',
      night: night.night,
      rows: night.rows,
      badLines: night.badLines,
    });
  });

  return app;
}
