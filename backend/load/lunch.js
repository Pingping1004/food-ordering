// k6 load scenarios for the PromptServe pilot (Sainampueng, ~2,500 students).
//
//   k6 run -e SCENARIO=ramp  load/lunch.js     (also: smoke | spike | soak | retry | mixed)
//   -e BASE=http://127.0.0.1:4010   -e RATE=50   -e DURATION=3m
//
// Data comes from `test/load/seed.ts` (load/data.json). Auth is a JWT-shaped test token for <userId>;
// everything else (rate limits, guards, validation, DB) is the real production pipeline.
import http from 'k6/http';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const data = JSON.parse(open('./data.json'));
const BASE = __ENV.BASE || 'http://127.0.0.1:4010';
const SCENARIO = __ENV.SCENARIO || 'smoke';
const RATE = Number(__ENV.RATE || 50);

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 400, 404, 409, 429));

export const ordersCreated = new Counter('orders_created');
export const shed429 = new Counter('shed_429');
export const serverErrors = new Counter('server_5xx');
export const status503 = new Counter('status_503');
export const status500 = new Counter('status_500');
export const orderCreateMs = new Trend('order_create_ms', true);
export const readMs = new Trend('read_ms', true);
export const okRate = new Rate('journey_ok');

// JWT-shaped test token; the harness's fake Supabase client accepts it (the production auth guard/cache still run).
const tokenFor = (userId) => `h.${encoding.b64encode(JSON.stringify({ sub: userId, aal: 'aal1' }), 'rawurl')}.s`;
const authHeaders = (userId, extra = {}) => ({
  headers: { Authorization: `Bearer ${tokenFor(userId)}`, 'Content-Type': 'application/json', ...extra },
});
const track = (res) => {
  if (res.status === 429) shed429.add(1);
  if (res.status >= 500) serverErrors.add(1);
  if (res.status === 503) status503.add(1);
  if (res.status === 500) status500.add(1);
  return res;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- student journey: open app -> browse -> order -> wait for the shop -----------------------------------
export function student() {
  const idx = exec.scenario.iterationInTest;
  const userId = data.students[idx % data.students.length];
  const shop = pick(data.restaurants);

  group('browse', () => {
    for (const [name, path] of [
      ['me_school', '/api/me/school'],
      ['shop_list', '/api/restaurant'],
      ['menu', `/api/menu/${shop.restaurantId}`],
      ['active_count', `/api/order/active-count/${shop.restaurantId}`], // shop page header
    ]) {
      const r = track(http.get(`${BASE}${path}`, { ...authHeaders(userId), tags: { endpoint: name } }));
      readMs.add(r.timings.duration);
      check(r, { [`${name} 200`]: (x) => x.status === 200 });
    }
  });
  sleep(1 + Math.random() * 2);

  const items = 1 + Math.floor(Math.random() * 3);
  const body = JSON.stringify({
    restaurantId: shop.restaurantId,
    pickupAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    orderMenus: Array.from({ length: items }, () => ({ menuId: pick(shop.menuIds), menuName: 'x', quantity: 1 + Math.floor(Math.random() * 2), unitPrice: 1 })),
  });
  const res = track(
    http.post(`${BASE}/api/order/create`, body, { ...authHeaders(userId, { 'Idempotency-Key': uuidv4() }), tags: { endpoint: 'order_create' } }),
  );
  orderCreateMs.add(res.timings.duration);
  const created = res.status === 201;
  okRate.add(created || res.status === 429);
  check(res, { 'order created or shed': (r) => r.status === 201 || r.status === 429 });
  if (!created) return;
  ordersCreated.add(1);

  const orderId = res.json('orderId');
  for (let i = 0; i < 3; i++) {
    sleep(3); // the real app polls every 20 s; compressed so one VU covers a student's whole wait
    const r = track(http.get(`${BASE}/api/order/${orderId}`, { ...authHeaders(userId), tags: { endpoint: 'order_poll' } }));
    readMs.add(r.timings.duration);
    check(r, { 'poll 200': (x) => x.status === 200 });
  }
}

// ---- cook: poll the queue and accept what arrives -------------------------------------------------------
export function cook() {
  const shop = data.restaurants[(exec.vu.idInTest - 1) % data.restaurants.length];
  const cookId = pick(shop.cookIds.concat(shop.ownerId));
  const r = track(http.get(`${BASE}/api/order/today/${shop.restaurantId}`, { ...authHeaders(cookId), tags: { endpoint: 'cook_queue' } }));
  readMs.add(r.timings.duration);
  check(r, { 'queue 200': (x) => x.status === 200 });
  if (r.status === 200) {
    const orders = (r.json('orders') || []).filter((o) => o.status === 'receive' && !o.acceptAt).slice(0, 5);
    for (const o of orders) {
      const a = track(http.patch(`${BASE}/api/order/accept/${o.orderId}`, '{}', { ...authHeaders(cookId), tags: { endpoint: 'cook_accept' } }));
      check(a, { 'accept 200': (x) => x.status === 200 });
    }
  }
  sleep(5);
}

// ---- retry storm: the same submit sent 5x at once (double tap + flaky network) ----------------------------
export function retryStorm() {
  const userId = data.students[exec.scenario.iterationInTest % data.students.length];
  const shop = pick(data.restaurants);
  const key = uuidv4();
  const body = JSON.stringify({
    restaurantId: shop.restaurantId,
    pickupAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    orderMenus: [{ menuId: shop.menuIds[0], menuName: 'x', quantity: 1, unitPrice: 1 }],
  });
  const reqs = Array.from({ length: 5 }, () => ['POST', `${BASE}/api/order/create`, body, { ...authHeaders(userId, { 'Idempotency-Key': key }), tags: { endpoint: 'order_create_retry' } }]);
  const rs = http.batch(reqs);
  rs.forEach(track);
  const ids = new Set(rs.filter((r) => r.status === 201).map((r) => r.json('orderId')));
  check(rs, { 'all retries answered with one order': () => ids.size === 1 });
  sleep(1);
}

const scenarios = {
  smoke: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'student' },
  ramp: {
    executor: 'ramping-arrival-rate', startRate: 1, timeUnit: '1s', preAllocatedVUs: 300, maxVUs: 3000, exec: 'student',
    stages: [
      { target: Math.round(RATE / 2), duration: '1m' },
      { target: RATE, duration: '1m' },
      { target: RATE, duration: __ENV.DURATION || '3m' },
      { target: 0, duration: '30s' },
    ],
  },
  // Bell rings: the whole school opens the app at once.
  spike: {
    executor: 'ramping-vus', startVUs: 0, exec: 'student', gracefulRampDown: '30s',
    stages: [
      { target: Number(__ENV.VUS || 2500), duration: '30s' },
      { target: Number(__ENV.VUS || 2500), duration: '60s' },
      { target: 0, duration: '20s' },
    ],
  },
  soak: { executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: __ENV.DURATION || '5m', preAllocatedVUs: 200, maxVUs: 1000, exec: 'student' },
  retry: { executor: 'constant-arrival-rate', rate: 20, timeUnit: '1s', duration: '1m', preAllocatedVUs: 100, maxVUs: 500, exec: 'retryStorm' },
};
// Constant arrival rate (iterations/s; each = ~9 requests incl. 1 order write): finds the throughput knee.
scenarios.knee = { executor: 'constant-arrival-rate', rate: RATE, timeUnit: '1s', duration: __ENV.DURATION || '90s', preAllocatedVUs: Math.round(RATE * 12), maxVUs: Math.round(RATE * 20), exec: 'student' };
// The pilot's realistic worst case: ~all 2,500 students place their one lunch order within a single minute.
scenarios.bell = { executor: 'constant-arrival-rate', rate: 42, timeUnit: '1s', duration: '60s', preAllocatedVUs: 600, maxVUs: 1500, exec: 'student' };
scenarios.mixed = {
  ...scenarios.ramp,
};

export const options = {
  scenarios:
    SCENARIO === 'mixed'
      ? { students: scenarios.mixed, cooks: { executor: 'constant-vus', vus: data.restaurants.length * 2, duration: '5m30s', exec: 'cook' } }
      : { [SCENARIO]: scenarios[SCENARIO] },
  thresholds: {
    server_5xx: ['count==0'],
    'http_req_duration{endpoint:order_create}': ['p(95)<800'],
    'http_req_duration{endpoint:menu}': ['p(95)<400'],
    'http_req_duration{endpoint:order_poll}': ['p(95)<400'],
    journey_ok: ['rate>0.995'],
  },
  summaryTrendStats: ['avg', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
};
