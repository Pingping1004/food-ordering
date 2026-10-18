# Pilot readiness — Sainampueng (≈2,500 students, 1 month)

Branch: `qa/pilot-readiness` (not merged, not pushed). Everything below is reproducible with the commands in [`test-plan.md`](test-plan.md).

## Verdict

**Conditional GO.** The ordering, payment, refund and permission logic now holds up under the tests and load that were run, and the defects that could have hurt a real lunch were fixed on the branch. It is **not** a GO until the five launch conditions below are met, because the parts that cannot be tested locally (real Supabase, Slip2Go, hosting plan and network latency) have not been exercised.

Evidence in one table:

| Question | Answer | Evidence |
|---|---|---|
| Can 2,500 students order at the bell? | Yes, with large margin on this hardware | 2,520 orders in 60 s: 100 % created, order create p95 11–21 ms ([capacity-report](capacity-report.md)) |
| Does the app survive an overload? | Yes | 2,500 concurrent VUs (≈ 14× normal rush rate): 0 5xx, excess answered 429, memory flat in a 10-minute soak |
| Does it survive the database disappearing? | Yes | 8 s outage mid-rush: 503 responses, auto-recovery, 0 duplicate or half-built orders |
| Can a student pay twice / reuse a slip / order twice? | No | Durable unique bank reference; idempotency on orders and payments; concurrent and "after restart" tests |
| Can one role act as another? | No cell in the matrix leaked | 119 routes × 13 actors, valid bodies, real database; mutation-checked (removing a guard fails the suite) |
| Does money move through the app? | No | `PaymentStatus.REFUNDED` is written in exactly one place (school admin's explicit "mark refunded"); static test guards it |

## Launch conditions (all five)

1. **Apply the schema changes to production and back up first.** Additive only: `Order.idempotencyKey` (+ unique with `userId`), `Menu.deletedAt`, new `Payout` table, new index `Order(restaurantId,status,orderAt)`. The project uses `prisma db push`: `cd backend && NODE_ENV=production npm run prisma:push:prod`. Prisma will flag the new unique constraint as a "data loss" warning (it cannot fail: every existing key is NULL); confirm it yourself. Then `npx ts-node scripts/backfill-payouts.ts` (dry run) and `--apply`, so already-paid orders appear in the weekly statements.
2. **Rehearse on the real stack once.** Same hosting plan and region as production, real Supabase, one real test payment with a real slip, one push to a real phone, and `SCENARIO=bell` + `SCENARIO=spike` from `capacity-report.md`. The local numbers are not a promise for your plan, and database latency (not CPU) will decide your response times.
3. **Put the API and the database in the same region** (Singapore) and use the pooler URL. Set `DB_POOL_MAX` to fit the database's connection limit.
4. **Update existing shops' cap** to 50 (SQL in decision 3) and make sure cooks know the cap exists.
5. **Remove `DEBUG_ALWAYS_OPEN` from `.env`/hosting config** (it is now ignored in production, but a leftover flag is a trap) and give the database a verified TLS connection (see `security.md`, residual risk 1).

## What was found and fixed (most important first)

| # | Defect | Impact on the pilot | Fix | Proven by |
|---|---|---|---|---|
| 1 | Payments/payouts stored in process memory | Same bank slip could pay for another order after any restart; shop statements erased on every deploy | Durable `Payout` table, unique bank reference, backfill script | `payment.int-spec.ts` (incl. "after restart" and racing slips) |
| 2 | Per-IP rate limits on a shared school IP | At the bell **58 of 2,521** orders succeeded | Per-user limits; IP limits as flood backstop | k6 `bell` with old vs new limits |
| 3 | No idempotency on `POST /order/create` | Double-tap or retry = duplicate orders | `Idempotency-Key` header, DB unique, client sends it and retries 429/503 | `order.int-spec.ts`, k6 `retry`, browser double-click test |
| 4 | Order transitions raced (accept/accept, accept/reject, accept/cancel) | Stock double-deducted 40/40 and stranded 39/40 in a stress run | Row lock per order | looped tests; fail when the lock is removed |
| 5 | Nine database pools, controllers registered twice | Up to 90 connections, pool starvation under load | One provider | `structure.int-spec.ts` |
| 6 | Shop push worker handled ~1 notification/s | New-order pushes minutes late in a rush | Batched, concurrent worker (≈ 40/s) | unit test + code path |
| 7 | Uploads buffered in memory before the permission check; unlimited sizes; files accepted by name only | Any account could exhaust memory; HTML could be served from the storage domain | Guards before parsing, limits, content check | `security.int-spec.ts` |
| 8 | Shop bank account/QR/e-mail sent to every student | Privacy/fraud | Redacted unless member/owner | `security.int-spec.ts` |
| 9a | Paid orders could be cancelled by the student | Shop cooks on money the student could then walk away from | 409 after payment | `order-lifecycle.int-spec.ts` |
| 9 | Deleting a menu item that was ever ordered → 500 | Owner cannot remove a dish | Archive (history intact, name reusable) | `journeys.int-spec.ts` |
| 10 | DB saturation / outage → opaque 500, log floods, internals in error bodies | Hard to diagnose, retries not possible | 503 + `Retry-After`, quiet 4xx logs, generic 500s | `http-exception.filter.spec.ts`, chaos run |
| 11 | Payment page white-screened on a malformed QR URL | Student cannot pay | Fail-safe image | browser E2E |
| 12 | 1 critical + 4 high dependency advisories (backend) | Includes libvips CVEs on untrusted images | `npm audit fix`, `sharp@0.35.5` | `npm run audit:prod` exits 0 |
| 13 | `uncaughtException` killed the process instantly; unhandled rejections too | A stray failed push could take the API down mid-rush | Log rejections; drain on fatal | code review |

> Note: while building the browser tests I briefly ran a second `next dev` that shared `frontend/.next` with the dev server you already had open on port 3000. It was stopped and your server was left running, but if it behaves oddly (stale pages, odd errors) restart it once. The E2E config now uses `.next-e2e`.

## Product decisions (answered by the owner, now implemented)

1. **Cooks may edit menus** — intended; only owner/admin delete. The matrix and tests already encode this. `rbac-api-contract.md` is out of date on this point.
2. **No cancelling after payment.** `PATCH /order/cancel/:id` now returns 409 `ORDER_ALREADY_PAID` for a paid order; the student's route is a refund request. Unpaid orders can still be cancelled.
3. **`maxActiveOrders` cap stays, default raised from 20 to 50** (fallback in order creation and default at shop registration). Shops that already exist have their own stored value (usually 20): run `UPDATE "Restaurant" SET "maxActiveOrders" = 50 WHERE "maxActiveOrders" = 20;` or change it per shop in settings.
4. **School dashboard shows real numbers from any number of orders** (e.g. 75 % from 4 orders, labelled "จาก N ออเดอร์"). The invented sample branch is gone; median accept time and rating are computed from data, and show "no data" when there is none. A school with no orders shows "no data", not 100 %.

Still open (not decided):

- `POST /admin/schools/:id/invite-code/rotate` is documented as a sysadmin action but returns `SYSADMIN_READ_ONLY` without a support grant.
- The student wait screen polls every 20 s, so after a shop accepts the student can wait up to 20 s to be moved to payment. 5–10 s would be fine for capacity.

## Known gaps

- **The coverage target from the brief (≥ 85 % lines / ≥ 80 % branches on services, guards and validators) was not reached.** Integration suite alone: 74.5 % lines / 48.2 % branches overall. By area (lines / branches): refund 97 / 74 · access 93 / 73 · guards 91 / 70 · invite 88 / 58 · payout 84 / 58 · restaurant 84 / 48 · supabase 78 / 54 · payment 77 / 56 · order 72 / 53 · school 67 / 30 · upload 64 / 36 · menu 62 / 39 · notification 59 / 27. The unit suite adds separate gates (`access` ≥ 85 %, `refund` ≥ 80 %, `common` ≥ 80 % lines). School admin (analytics/summary), menu bulk import, notification dispatch and the upload service are the least covered.
- Browser E2E covers three journeys, not every role flow. The remaining flows are covered at API level only.
- No frontend component/unit tests exist.
- Soak ran 10 minutes (target 30).
- Real third-party services are mocked (see `test-plan.md`).
- The load numbers come from one laptop that also ran k6 and Postgres.
- Frontend dependency advisories (11 high) remain (`security.md`).

## What changed, where

`git log qa/pilot-readiness --oneline` has one commit per concern. Highlights:

- **API**: `src/guards/user-rate-limit.guard.ts`, `src/common/fixed-window-limiter.ts`, `src/rateLimiting.middleware.ts`, `src/app.setup.ts` (shared middleware setup extracted from `main.ts`), `src/order/order.service.ts` (idempotency, row lock, off-path side effects), `src/payout/payout.service.ts` (database-backed), `src/payment/payment.service.ts`, `src/supabase/supabase.service.ts` (caches), `src/libs/*.filter.ts`, `src/notification/notification.service.ts` (worker), `src/upload/*`, `src/s3/s3.service.ts`, `src/utils/file-upload.utils.ts`, `src/menu/*` (archive on delete, guards), `src/restaurant/restaurant.controller.ts` (redaction), module wiring.
- **Schema**: `Order.idempotencyKey`, `Menu.deletedAt`, `Payout`, one composite index.
- **Web**: school overview sample-data banner, `lib/api.ts` (retry 429/503 for idempotent requests), `util/idempotency.ts`, confirm page sends `Idempotency-Key`, payment page QR fail-safe.
- **Tests/CI/docs**: `backend/test/integration/*`, `backend/load/*`, `frontend/tests/e2e/*`, `.github/workflows/ci.yml`, `docs/*`.
