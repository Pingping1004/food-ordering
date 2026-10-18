import request from 'supertest';
import { authHeader, bootTestApp, TestApp } from './harness';
import { discoverRoutes } from './routes';
import { MATRIX } from './rbac-matrix';
import { ACTORS, Actor, makeRbacWorld, RbacWorld } from './rbac-world';

const DENIED = new Set([401, 403, 404]);
/** Validation runs before the in-handler authz on a few routes, so a 400 from a refused actor changed nothing. */
const NO_EFFECT = new Set([400, 413, 422]);

const fill = (tpl: string, w: RbacWorld, route: string) => {
  const memberId = route.includes('/schools/') ? w.ids.schoolMemberId : w.ids.restaurantMemberId;
  const codeId = route.includes('/admin/') || route.includes('/schools/') ? w.ids.schoolCodeId : w.ids.shopCodeId;
  const id = route.includes('refund') ? w.ids.refundId : route.includes('complaints') ? w.ids.complaintId : route.includes('support-grants') ? w.ids.grantId : w.ids.refundId;
  return tpl
    .replace(':schoolId', w.ids.schoolId).replace(':restaurantId', w.ids.restaurantId).replace(':menuId', w.ids.menuId)
    .replace(':orderId', w.ids.orderId).replace(':canteenId', w.ids.canteenId).replace(':userId', w.ids.userId)
    .replace(':payoutId', w.ids.payoutId).replace(':memberId', memberId).replace(':codeId', codeId).replace(':id', id);
};

describe('RBAC matrix (every route x every actor, real HTTP + real Postgres)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  const routes = () => [...new Map(discoverRoutes(t.app).map((r) => [r.key, r])).values()];

  it('should have an access decision for every route, and no stale entries', () => {
    const keys = routes().map((r) => r.key);
    expect(keys.filter((k) => !MATRIX[k])).toEqual([]);
    expect(Object.keys(MATRIX).filter((k) => !keys.includes(k))).toEqual([]);
  });

  it('should refuse every actor outside the allow-list and never block an allowed one', async () => {
    const failures: string[] = [];
    const softNotes: string[] = [];
    for (const route of routes()) {
      const rule = MATRIX[route.key];
      if (!rule || rule.skip) continue;
      const w = await makeRbacWorld(t.prisma, rule.orderState ?? 'done');
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const send = async (actor: Actor) => {
        const q = rule.query ? '?' + fill(rule.query, w, route.path) : '';
        let req = request(t.url)[method](fill(route.path, w, route.path) + q);
        if (actor !== 'anon') req = req.set(authHeader(w.userIds[actor]));
        return method === 'get' ? req : req.send(rule.body ? JSON.parse(fill(JSON.stringify(rule.body), w, route.path)) : {});
      };
      const denied = ACTORS.filter((a) => !rule.allow.includes(a) && !(rule.either ?? []).includes(a));
      const allowed = ACTORS.filter((a) => rule.allow.includes(a));

      for (const actor of denied) {
        if (rule.public && actor === 'anon') continue;
        const res = await send(actor);
        if (actor === 'anon') { if (res.status !== 401) failures.push(`${route.key} [anon] expected 401 got ${res.status}`); continue; }
        if (rule.public) continue;
        if (DENIED.has(res.status)) continue;
        if (NO_EFFECT.has(res.status)) { softNotes.push(`${route.key} [${actor}] ${res.status} (validation precedes authz)`); continue; }
        failures.push(`${route.key} [${actor}] expected 401/403/404 got ${res.status}`);
      }
      if (rule.public) {
        const res = await send('anon');
        if (res.status === 401 || res.status === 403) failures.push(`${route.key} [anon] public route blocked: ${res.status}`);
      }
      for (const actor of allowed) {
        const res = await send(actor);
        if (res.status === 401 || res.status === 403 || res.status >= 500)
          failures.push(`${route.key} [${actor}] allowed actor got ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
      }
    }
    if (softNotes.length) console.warn(`validation-before-authz (${softNotes.length}):\n` + softNotes.join('\n'));
    expect(failures).toEqual([]);
  }, 600_000);
});
