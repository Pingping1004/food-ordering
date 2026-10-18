import { bootTestApp, TestApp } from './harness';
import { discoverRoutes } from './routes';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Application structure', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  it('should register every route exactly once', () => {
    const keys = discoverRoutes(t.app).map((r) => r.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it('should create exactly one PrismaService (one connection pool) for the whole app', () => {
    const container = (t.app as any).container;
    let count = 0;
    for (const mod of container.getModules().values())
      for (const w of mod.providers.values()) if (w.metatype === PrismaService) count++;
    expect(count).toBe(1);
  });
});
