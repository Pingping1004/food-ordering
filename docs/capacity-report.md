# Capacity report — Sainampueng pilot (≈2,500 students, 1 month)

## Method and its limits (read this first)

- One MacBook (10 cores, 16 GB): **k6, the Node API (one process) and Postgres 16 all on the same machine**, loopback network, `fsync=off` on Postgres. CPU contention makes the numbers pessimistic; loopback latency and no disk flush make them optimistic. Treat them as **relative evidence and a lower bound for the code**, not as a promise for your hosting plan.
- The API is the real `AppModule` with the real middleware and guards. Identity is faked (JWT-shaped tokens); Slip2Go/Firebase/S3 are not called. See `test-plan.md`.
- Data: 1 school, 12 shops × 12 dishes, 2,500 students (`npm run load:seed`). Shops are manual-accept, so orders stay `receive` (no cooks in most runs).
- Scripts: `backend/load/lunch.js`, scenarios `bell | retry | ramp | knee | spike | soak | smoke | mixed`. Re-run them on your real staging host before launch (see "Before launch").

## What load to expect

| Quantity | Estimate | How derived |
|---|---|---|
| Orders per day | ≤ 1,750 | 70 % of 2,500 students, one order each |
| Average rate in the 12-minute rush | 2.4 orders/s | 1,750 / 720 s |
| **Worst realistic minute ("bell")** | **42 orders/s** | everyone orders within 60 s → the `bell` scenario (2,520 journeys in 60 s; each journey = 7 requests → ≈ 290 requests/s at the peak) |
| Background polling | ≈ 90 requests/s | ~1,750 waiting students × one status poll per 20 s |

## Results

All runs: 0 responses with a 5xx status, 0 duplicate orders (checked in SQL afterwards), unless stated.

| Scenario | Load | order create p95 | reads p95 | Outcome |
|---|---|---|---|---|
| **Bell** ×3 | 2,520 orders in a 60 s arrival window (≈ 290 req/s at the peak; 17,640 requests in total, ≈ 246 req/s averaged over the run) | **11 – 21 ms** | 4 – 6 ms | 100 % of orders created, nothing shed |
| Knee, 60 journeys/s | ≈ 53 orders/s, 371 req/s, 90 s | 11.9 ms | 2.9 ms | clean |
| Knee, 90 journeys/s ×9 | ≈ 80 orders/s, ≈ 550 req/s, 60 s each | 5 clean runs at 5 – 11 ms; 4 degraded runs at 69 ms – 2.9 s (the orders table and the push backlog grow run after run) | 2 – 1,300 ms | **the sustained limit of this setup is ≈ 55 orders/s**; above it latency degrades but never errors |
| Soak, 10 min | 10 orders/s (6,000 orders), 69 req/s | 18 ms, flat | 6 ms | 0 errors; **memory flat after warm-up (RSS ≈ 160–200 MB)**, no creep |
| Retry storm | 1,200 students each submitting the same order 5× concurrently | — | — | **exactly 1,200 orders**, 0 duplicates, 0 5xx |
| Overload ("spike") | 2,500 VUs continuously, ≈ 1,500 req/s (≈ 14× the average rush rate) | 4.2 s | 1 s | **0 5xx**; 45 % of requests answered 429 by the limiters — graceful shedding, process healthy |
| **DB outage** | Postgres killed for 8 s in the middle of a bell run | — | — | API stayed up, answered **503** (never 500) while the DB was away, recovered by itself; **0 duplicate or half-built orders** |
| Original per-IP limits (replayed) | the bell run with the limits as they were (30 orders/min, 300 req/min per IP) | — | — | **58 of 2,521 orders (2.3 %)** created, 9,802 requests rejected |

Targets from the brief vs. measured:

| Target | Result |
|---|---|
| ≥ 50 order writes/s sustained | ✅ ≈ 53/s clean; degrades above ≈ 55/s |
| 300 reads/s | ✅ 371 req/s total at 60 journeys/s with reads p95 3 ms (bell run: ≈ 290 req/s peak, reads p95 4–6 ms) |
| 3× burst for 60 s | ✅ the bell minute is ≈ 3.5× the "4× average" planning peak; overload above that sheds (429) instead of failing |
| p95 < 400 ms reads / < 800 ms writes | ✅ up to ≈ 55 orders/s sustained |
| Error rate < 0.5 %, zero 5xx from overload | ✅ (503 only during the deliberate DB kill) |
| Zero duplicate orders | ✅ verified after retry storm, bell and chaos runs |
| 30-minute soak | ⚠️ 10 minutes run (flat); not 30 |

**Headroom:** the measured sustained limit (≈ 55 orders/s) is ≈ 1.3× the extreme bell minute (42/s), ≈ 5× a 10 orders/s peak, and ≈ 20× the average rush (2.4/s).

## Bottlenecks found and removed

| # | Bottleneck | Effect | Fix |
|---|---|---|---|
| 1 | Per-IP limits on a shared school IP | 97.7 % of the rush rejected | Per-user limiter after login; IP limits become a flood backstop (60,000/min) |
| 2 | **`PrismaService` provided in 9 modules** → 9 connection pools × 10 and every controller registered twice | up to 90 DB connections, unpredictable pool starvation, wasted memory | One global provider (guarded by a test) |
| 3 | Shop "new order" push worker: 20 jobs per 20 s, sequential | ≈ 1 push per second → shops notified minutes late in a rush | Batches of 200 every 5 s, 5 concurrent, no overlap (≈ 40/s) |
| 4 | Analytics + push queueing awaited inside `POST /order/create` | slower response, held a DB slot | Moved after the response (best-effort, logged on failure) |
| 5 | A DB lookup on every request to load `req.user`; one Supabase call per request burst | extra queries, outbound dependency on the hot path | Token cache with in-flight de-dup (30 s), bad-token negative cache (5 s), user cache (5 s) |
| 6 | Pool exhaustion / DB down surfaced as opaque 500s | clients could not tell "retry" from "bug" | 503 + `Retry-After`; the app retries idempotent requests with jitter |
| 7 | Composite index missing for the "active orders per shop" count | seq-scan growth with order history | `Order(restaurantId, status, orderAt)`; plan is an index-only scan (0.6 ms at 90 k rows) |

## Where the time goes (and why your hosting matters more than this laptop)

SQL statements per request (counted from the Postgres log): `me/school` 4 · shop list 5 · menu 7–11 · order status poll 4 · cook queue 7 · **order create ≈ 30**. Locally a statement costs ≈ 0.2 ms, so these are invisible. **On a hosted database every statement pays a network round trip**: at 2 ms an order create is ≈ 60 ms, at 30 ms (API and database in different regions) it is ≈ 1 s, and the connection is held the whole time, which shrinks the effective pool.

→ Put the API and the database in the same region (Singapore for Thailand), use the provider's pooler, and re-measure there.

## Knobs

| Setting | Default | Notes |
|---|---|---|
| `DB_POOL_MAX` | 20 | per API process; (instances × this) must stay below the database's connection limit (use the pooler URL). On this laptop 10 and 20 behaved the same; 50 was worse (more concurrent backends than cores) |
| `DB_STATEMENT_TIMEOUT_MS` | 15000 | kills runaway queries; `idle_in_transaction_session_timeout` is 15 s |
| `IP_LIMIT_MULTIPLIER` | 1 | scales every IP limiter (global 60,000/min, order create 6,000/min, payments 1,500/5 min) |
| `JSON_BODY_LIMIT` | 256kb | `/payment/verify` keeps 10 MB for the slip image |
| Per-user limits | order create 30/min, payment 10/5 min, refund 5/5 min, other 240/min | `src/guards/user-rate-limit.guard.ts` |
| Shop `maxActiveOrders` | 20 (registration allows ≤ 50) | a **business** throttle: when a shop already has that many `receive`+`cooking` orders, new orders get 409. At lunch this will reject students if a cook falls behind — set it from the shop's real throughput |

## Before launch (checklist)

1. Apply the schema changes to production (`prisma db push`): `Order.idempotencyKey` + unique, `Menu.deletedAt`, `Payout` table, `Order(restaurantId,status,orderAt)` index. All additive. Then run `npx ts-node scripts/backfill-payouts.ts` (dry run first, then `--apply`).
2. On the **real staging host and plan** (same instance size and region as production): `npm run load:seed`, `npm run load:server`, then `SCENARIO=bell` and `SCENARIO=spike`. Expect the order-create p95 to be dominated by database latency; if it is above ≈ 500 ms at the bell load, raise the instance size or fix the region before launch.
3. Set `DB_POOL_MAX` to fit the database plan; confirm the connection string is the pooler.
4. Run a 30-minute soak (`SCENARIO=soak DURATION=30m`).
5. Watch these during the first lunches: 429 and 503 counts, p95 of `POST /order/create`, DB connections, API RSS, and the age of the oldest pending `PushNotificationJob`.
