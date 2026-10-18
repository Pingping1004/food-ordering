/* Standalone API for load tests: the real AppModule + real production pipeline, fake identity provider (see harness).
 * Usage: DATABASE_URL=postgresql://postgres@localhost:55432/promptserve_load PORT=4010 npx ts-node -r tsconfig-paths/register --transpile-only test/load/server.ts
 *   LOAD_FAKE_SLIP=1  answer Slip2Go slip checks locally with "valid slip" (lets k6 run the whole lunch journey incl. payment).
 */
import axios from 'axios';
import { randomUUID } from 'crypto';
import { monitorEventLoopDelay } from 'perf_hooks';
import { bootTestApp } from '../integration/harness';

if (process.env.LOAD_FAKE_SLIP === '1') {
  const realPost = axios.post.bind(axios);
  (axios as { post: typeof axios.post }).post = (async (url: string, ...rest: unknown[]) => {
    if (!url.startsWith('https://connect.slip2go.com/api/verify-slip/')) return (realPost as any)(url, ...rest);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500)); // the real call takes ~0.3–0.8 s
    return { data: { code: '200200', message: 'ok', data: { dateTime: new Date().toISOString(), transRef: `LT${randomUUID().replace(/-/g, '').slice(0, 16)}` } } };
  }) as typeof axios.post;
}

(async () => {
  const port = Number(process.env.PORT ?? 4010);
  const t = await bootTestApp({ port, logger: process.env.LOAD_LOGS === '1' ? ['log', 'warn', 'error'] : ['error'] });
  console.log(`load server listening on ${t.url}${process.env.LOAD_FAKE_SLIP === '1' ? ' (fake Slip2Go)' : ''}`);
  // A latency spike is either the process stalling (event loop / GC / the OS paging it out) or slow queries. Log
  // every second whose worst event-loop delay was over 200 ms, so a run's log says which one it was.
  const eld = monitorEventLoopDelay({ resolution: 20 });
  eld.enable();
  setInterval(() => {
    const maxMs = eld.max / 1e6;
    if (maxMs > 200) console.log(`${new Date().toISOString()} event-loop stall ${maxMs.toFixed(0)} ms, rss ${(process.memoryUsage.rss() / 2 ** 20).toFixed(0)} MB`);
    eld.reset();
  }, 1000).unref();
  process.on('SIGTERM', () => t.close().finally(() => process.exit(0)));
})();
