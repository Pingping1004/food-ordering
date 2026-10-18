// k6 load scenarios for the PromptServe pilot (Sainampueng, ~2,500 students).
//
//   k6 run -e SCENARIO=ramp  load/lunch.js     (also: smoke | spike | soak | retry | mixed | lunch)
//   SCENARIO=lunch: the whole lunch in real time (bell → wait → pay → cook → pick up) with the app's
//   polling schedule; -e POLL=old (fixed 3 s/5 s, as before), POLL=new (status-based intervals, full order each
//   poll) or POLL=status (light /status route, server-paced by X-Poll-After with ±20 % jitter, full order only on
//   change; -e PUSH_SHARE=0.5 = half the students have push on, so their accept-wait polls every 10 s).
//   Needs the load server started with LOAD_FAKE_SLIP=1.
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
// Which kind of request was shed (so a 429 count can be attributed: student polls vs the kitchen vs order writes).
const kindOf = (url) => (/\/order\/(accept|ready|done)\//.test(url) ? 'kitchen_write' : /\/order\/today\//.test(url) ? 'kitchen_read' : /\/order\/create/.test(url) ? 'order_create' : /\/order\/[0-9a-f-]{36}(\?|$)/.test(url) ? 'order_poll' : /\/order\/[0-9a-f-]{36}\/status(\?|$)/.test(url) ? 'order_status' : 'other');
const track = (res) => {
  if (res.status === 429) shed429.add(1, { kind: kindOf(res.url) });
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

// ---- full lunch journey (SCENARIO=lunch) -----------------------------------------------------------------
// Real-time phases, per order (deterministic from the orderId so both POLL modes see the same lunch):
//   shop accepts after 15–120 s · student pays 20–60 s later · cooking 4–8 min · picked up 1–3 min after "ready".
// Every student is assumed to keep the screen open the whole time (worst case: real phones lock and pause polling).
const POLL = __ENV.POLL || 'new';
const SLIP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVQokWNgWMVAGmIY1cAwGkqrhmnSAABiTKoBe3aB/wAAAABJRU5ErkJggg=='; // 16×16 PNG (decoded by the server's image check)
export const polls = new Counter('polls');
export const journeyDone = new Counter('journeys_completed');
export const fullLoads = new Counter('full_order_loads');
const PUSH_SHARE = Number(__ENV.PUSH_SHARE || 0);
const frac = (id, salt) => { let h = 2166136261; const t = id + salt; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
const PHASE_SCALE = Number(__ENV.PHASE_SCALE || 1); // <1 only for a quick smoke run; real measurements use 1
const between = (id, salt, lo, hi) => (lo + frac(id, salt) * (hi - lo)) * PHASE_SCALE;

/** Mirrors frontend pollIntervalFor (POLL=new) or the previous fixed intervals (POLL=old), in seconds. */
function pollSeconds(o) {
  const pay = String(o.paymentStatus).toUpperCase();
  const failed = o.status === 'rejected' || pay === 'CANCELLED' || pay === 'REFUNDED';
  const screen = failed ? 'failed' : pay !== 'PAID' ? (o.acceptAt || o.status !== 'receive' ? 'payment' : 'wait') : o.status === 'ready' || o.status === 'done' ? 'done' : 'wait';
  if (POLL === 'old') return { screen, every: screen === 'wait' ? 3 : screen === 'done' ? 5 : screen === 'failed' ? 10 : null };
  const every = screen === 'wait' ? (o.status === 'receive' ? 5 : 15) : screen === 'done' ? (o.status === 'ready' ? 10 : null) : null;
  return { screen, every };
}

export function lunchStudent() {
  const idx = exec.scenario.iterationInTest;
  const userId = data.students[idx % data.students.length];
  const shop = data.restaurants[idx % data.restaurants.length];
  const h = authHeaders(userId);
  for (const path of ['/api/me/school', '/api/restaurant', `/api/menu/${shop.restaurantId}`, `/api/order/active-count/${shop.restaurantId}`]) {
    track(http.get(`${BASE}${path}`, { ...h, tags: { endpoint: 'browse' } }));
  }
  sleep(5 + Math.random() * 10); // choosing
  const body = JSON.stringify({ restaurantId: shop.restaurantId, pickupAt: new Date(Date.now() + 40 * 60 * 1000).toISOString(), orderMenus: [{ menuId: pick(shop.menuIds), menuName: 'x', quantity: 1, unitPrice: 1 }] });
  const res = track(http.post(`${BASE}/api/order/create`, body, { ...authHeaders(userId, { 'Idempotency-Key': uuidv4() }), tags: { endpoint: 'order_create' } }));
  orderCreateMs.add(res.timings.duration);
  if (res.status !== 201) return;
  ordersCreated.add(1);
  const orderId = res.json('orderId');

  if (POLL === 'status') return lunchStatusPolling(userId, orderId, h);

  let paid = false;
  let doneAt = null;
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const r = track(http.get(`${BASE}/api/order/${orderId}`, { ...h, tags: { endpoint: 'order_poll' } }));
    readMs.add(r.timings.duration);
    if (r.status !== 200) { sleep(5); continue; }
    polls.add(1);
    const o = r.json();
    const { screen, every } = pollSeconds(o);
    if (screen === 'failed') return;
    if (screen === 'payment' && !paid) {
      sleep(between(orderId, 'pay', 20, 60)); // transfer in the banking app, come back, attach the slip
      const v = track(http.post(`${BASE}/api/payment/verify`, JSON.stringify({ idempotencyKey: uuidv4(), orderId, paymentSlipImg: SLIP }), { ...h, tags: { endpoint: 'payment_verify' } }));
      paid = v.status === 201 || v.status === 200;
      continue; // the app goes straight to the wait screen, which polls immediately
    }
    if (o.status === 'done') {
      // old done page kept polling every 5 s until the student closed it (assume 60 s); new one stops
      if (POLL === 'old') { doneAt = doneAt || Date.now(); if (Date.now() - doneAt > 60_000) break; }
      else break;
    }
    if (every === null) break;
    sleep(every);
  }
  journeyDone.add(1);
}

/**
 * POLL=status: what the app does now (frontend useStudentOrder). Load the full order once, then poll the one-row
 * /status route at the pace the server sends (X-Poll-After, ±20 % jitter); reload the full order only when the status
 * record changed. X-Poll-After 0 = finished, stop.
 */
function lunchStatusPolling(userId, orderId, h) {
  const push = frac(orderId, 'push') < PUSH_SHARE;
  const q = push ? '?push=1' : '';
  const full = () => {
    const r = track(http.get(`${BASE}/api/order/${orderId}${q}`, { ...h, tags: { endpoint: 'order_full' } }));
    if (r.status === 200) fullLoads.add(1);
    return r;
  };
  let r = full();
  let known = r.status === 200 ? r.json() : null;
  let paid = false;
  const deadline = Date.now() + 25 * 60 * 1000;
  while (Date.now() < deadline) {
    const after = Number(r.headers['X-Poll-After']);
    if (r.status === 200 && known) {
      const { screen } = pollSeconds(known);
      if (screen === 'failed') return;
      if (screen === 'payment' && !paid) {
        sleep(between(orderId, 'pay', 20, 60));
        const v = track(http.post(`${BASE}/api/payment/verify`, JSON.stringify({ idempotencyKey: uuidv4(), orderId, paymentSlipImg: SLIP }), { ...h, tags: { endpoint: 'payment_verify' } }));
        paid = v.status === 201 || v.status === 200;
        r = full(); // the wait screen mounts and loads the order
        if (r.status === 200) known = r.json();
        continue;
      }
      if (after === 0) break;
    }
    const every = r.status === 200 && Number.isFinite(after) && after > 0 ? after : 5;
    sleep(every * (0.8 + Math.random() * 0.4));
    r = track(http.get(`${BASE}/api/order/${orderId}/status${q}`, { ...h, tags: { endpoint: 'order_status' } }));
    readMs.add(r.timings.duration);
    if (r.status !== 200) continue;
    polls.add(1);
    const s = r.json();
    const changed = !known || s.status !== known.status || s.paymentStatus !== known.paymentStatus || (s.acceptAt || null) !== (known.acceptAt || null) || s.updatedAt !== known.updatedAt;
    if (changed) {
      const f = full();
      if (f.status === 200) { known = f.json(); r = f; }
    }
  }
  journeyDone.add(1);
}

export function lunchCook() {
  // One long iteration per cook VU, so iterationInTest is 0..11 = one shop each. (vu.idInTest is numbered across
  // both scenarios, so `% shops` could give two cooks the same shop and leave one shop's orders to auto-reject.)
  const shop = data.restaurants[exec.scenario.iterationInTest % data.restaurants.length];
  // The owner and the two cooks share the kitchen work, as in a real shop (each account has its own per-user limit).
  const staff = [shop.ownerId, ...shop.cookIds];
  let turn = 0;
  const next = () => authHeaders(staff[turn++ % staff.length]);
  const h = authHeaders(shop.ownerId);
  const seen = {}; // orderId -> { cookingSince, readySince }
  while (exec.scenario.progress < 1) {
    const r = track(http.get(`${BASE}/api/order/today/${shop.restaurantId}`, { ...h, tags: { endpoint: 'cook_queue' } }));
    if (r.status === 200) {
      const now = Date.now();
      for (const o of r.json('orders') || []) {
        const s = (seen[o.orderId] = seen[o.orderId] || {});
        const ageS = (now - new Date(o.orderAt).getTime()) / 1000;
        if (o.status === 'receive' && !o.acceptAt && ageS >= between(o.orderId, 'accept', 15, 120)) {
          track(http.patch(`${BASE}/api/order/accept/${o.orderId}`, '{}', { ...next(), tags: { endpoint: 'cook_accept' } }));
        } else if (o.status === 'cooking' || o.status === 'delay') {
          s.cookingSince = s.cookingSince || now;
          if (now - s.cookingSince >= between(o.orderId, 'cook', 240, 480) * 1000)
            track(http.patch(`${BASE}/api/order/ready/${o.orderId}`, '{}', { ...next(), tags: { endpoint: 'cook_ready' } }));
        } else if (o.status === 'ready') {
          s.readySince = s.readySince || now;
          if (now - s.readySince >= between(o.orderId, 'pickup', 60, 180) * 1000)
            track(http.patch(`${BASE}/api/order/done/${o.orderId}`, '{}', { ...next(), tags: { endpoint: 'cook_done' } }));
        }
      }
    }
    sleep(4);
  }
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

// The bell: 2,520 students arrive within 60 s, then live through the whole lunch (≈ 15 min) while 12 shops work.
const LUNCH_MIN = Number(__ENV.LUNCH_MIN || 18);
scenarios.lunchStudents = { executor: 'constant-arrival-rate', rate: Number(__ENV.LUNCH_RATE || 42), timeUnit: '1s', duration: __ENV.LUNCH_ARRIVE || '60s', preAllocatedVUs: 2600, maxVUs: 2700, exec: 'lunchStudent', gracefulStop: `${LUNCH_MIN}m` };
scenarios.lunchCooks = { executor: 'constant-vus', vus: data.restaurants.length, duration: `${LUNCH_MIN}m`, exec: 'lunchCook' };

export const options = {
  scenarios:
    SCENARIO === 'mixed'
      ? { students: scenarios.mixed, cooks: { executor: 'constant-vus', vus: data.restaurants.length * 2, duration: '5m30s', exec: 'cook' } }
      : SCENARIO === 'lunch'
        ? { students: scenarios.lunchStudents, cooks: scenarios.lunchCooks }
        : { [SCENARIO]: scenarios[SCENARIO] },
  thresholds: {
    server_5xx: ['count==0'],
    // listed so the summary breaks 429s down by kind
    'shed_429{kind:order_poll}': ['count>=0'], 'shed_429{kind:kitchen_write}': ['count>=0'], 'shed_429{kind:kitchen_read}': ['count>=0'], 'shed_429{kind:order_create}': ['count>=0'], 'shed_429{kind:order_status}': ['count>=0'], 'shed_429{kind:other}': ['count>=0'],
    'http_req_duration{endpoint:order_create}': ['p(95)<800'],
    'http_req_duration{endpoint:menu}': ['p(95)<400'],
    'http_req_duration{endpoint:order_poll}': ['p(95)<400'],
    'http_req_duration{endpoint:order_status}': ['p(95)<400'],
    'http_req_duration{endpoint:order_full}': ['p(95)<400'],
    journey_ok: ['rate>0.995'],
  },
  summaryTrendStats: ['avg', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
  // No `url`/`name` tags: every orderId URL became its own time series (100k+ in a lunch run), bloating k6's memory on
  // the same machine as the server under test. `endpoint` already groups requests.
  systemTags: ['status', 'method', 'scenario', 'group', 'check', 'error', 'error_code', 'expected_response'],
};
