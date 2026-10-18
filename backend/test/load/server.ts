/* Standalone API for load tests: the real AppModule + real production pipeline, fake identity provider (see harness).
 * Usage: DATABASE_URL=postgresql://postgres@localhost:55432/promptserve_load PORT=4010 npx ts-node -r tsconfig-paths/register --transpile-only test/load/server.ts
 */
import { bootTestApp } from '../integration/harness';

(async () => {
  const port = Number(process.env.PORT ?? 4010);
  const t = await bootTestApp({ port, logger: process.env.LOAD_LOGS === '1' ? ['log', 'warn', 'error'] : ['error'] });
  console.log(`load server listening on ${t.url}`);
  process.on('SIGTERM', () => t.close().finally(() => process.exit(0)));
})();
