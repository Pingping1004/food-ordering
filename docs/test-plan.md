# Test plan

What is tested, at which level, where it lives, and what was assumed. Run everything with the commands at the bottom.

## Levels

| Level | Tooling | Where | Database |
|---|---|---|---|
| Unit | Jest | `backend/src/**/*.spec.ts` | none (mocks) |
| Integration | Jest + supertest over a **real listening server** | `backend/test/integration/*.int-spec.ts` | real Postgres, schema pushed from `schema.prisma` |
| Browser E2E | Playwright | `frontend/tests/e2e/*.spec.ts` | real Postgres |
| Load / resilience | k6 | `backend/load/lunch.js` | real Postgres |
| Static / supply chain | `tsc`, `npm audit` | CI | none |

Integration, load and E2E run the real `AppModule` and the real production middleware (`configureApp()` in `src/app.setup.ts`, shared with `main.ts`: helmet, compression, CORS, IP limiters, validation, filters, body limits). The only things replaced are the **identity provider** (Supabase Auth → a fake client that accepts JWT-shaped tokens; the real `SupabaseService` token cache, in-flight de-dup and user cache still run), **push** (Firebase) and the **S3 network call**. The Slip2Go HTTP call is mocked per test.

The harness refuses to start unless `DATABASE_URL` points at `localhost`/`127.0.0.1`.

## Feature coverage

| Area | What is asserted | File(s) | Level | Priority |
|---|---|---|---|---|
| **RBAC** | Every route × 13 actors (anonymous, no-school user, student, student of another school, pending cook, cook, shop admin, owner, owner of another shop, school admin, school admin of another school, sysadmin with/without TOTP). Refused actors get 401/403/404 **with a valid body and a state in which the action would succeed**, so a missing guard shows up as a 2xx. A route missing from the table fails the build. | `rbac-matrix.ts`, `rbac.int-spec.ts`; rendered in [`rbac-matrix.md`](rbac-matrix.md) | Integration | P0 |
| **Auth / sessions** | 401 for no/empty/garbage/wrong-scheme token; no cookies (no CSRF surface); token verification de-duplicated and bad tokens negative-cached; user row cached ≤5 s, re-read after sign-out | `security.int-spec.ts`, `supabase.service.spec.ts` | Int + Unit | P0 |
| **Onboarding / approvals** | Student joins with school code (case/dash tolerant, generic error for unknown codes, 409 for a second school, plain message for suspended school); cook code → PENDING → no kitchen access → owner approves → access on the next request → removal revokes immediately; cook cannot self-approve; double approve = 409; sysadmin-issued school-admin code = approved admin | `journeys.int-spec.ts`, `invite-code.service.spec.ts` | Int + Unit | P0 |
| **Shop registration → school approval** | Owner-grant code → `POST /restaurant` (multipart + QR) → PENDING shop invisible to students and not orderable → school admin approves → orderable → suspend blocks orders and is audited; illegal jump (REMOVED → ACTIVE) = 409 | `journeys.int-spec.ts`; browser: `school-approval.spec.ts` | Int + E2E | P0 |
| **Student ordering** | Server-side pricing (a tampered client `unitPrice` is ignored), school tenancy (other school → 404), other-shop dish → 400, unavailable dish → 400, pickup too soon → 400, queue cap, history, BOLA on read | `order.int-spec.ts`, `security.int-spec.ts` | Int | P0 |
| **Order state machine** | Every legal/illegal transition from every state; accept/ready/done/reject; student cancel (own only), cancel twice | `order-lifecycle.int-spec.ts` | Int | P0 |
| **Idempotency** | Same `Idempotency-Key` ×2 sequential and ×20 concurrent → one order and one stock decrement; same key + different cart → 409; keys scoped per user; malformed key → 400. Payment: replay, 5 concurrent submits, same key + different slip → 409, same slip on a second order → 409 (also after a simulated restart and when racing); refund filing: 5 concurrent → 1 | `order.int-spec.ts`, `payment.int-spec.ts`, `refund.int-spec.ts`; browser: double-click confirm | Int + E2E | P0 |
| **Stock** | 40 students racing for 10 portions → never more than 10 sold; accept/accept, accept/reject, accept/cancel races (looped ×15) never double-deduct or strand reserved stock | `order.int-spec.ts`, `order-lifecycle.int-spec.ts` | Int | P0 |
| **Payments** | Slip valid → PAID + one `Payout` row; exact amount/receiver/date conditions sent to Slip2Go; wrong slip → UNPAID + payout `failed` + retry works; verifier down/timeout → clean 4xx and still payable; slip older than the order refused; junk image never reaches the paid API; only the order owner; not before the shop accepts; not for cancelled orders; paid order → success without a second call; shop sees its payouts, others do not | `payment.int-spec.ts` | Int | P0 |
| **Refunds (manual, school-handled)** | Own paid order only; unpaid → `ORDER_NOT_PAID`; one open request per order (5 concurrent → 1); re-file after reject; approve/reject never touch `paymentStatus`; `REFUNDED` only via explicit `mark_refunded` after approval, never repeatable; two admins racing → one 200 + one 409; reject needs a reason; audit row per decision; shop staff/owner/student/other-school admin cannot decide; **static test that `REFUNDED` is written from exactly one place** | `refund.int-spec.ts`, `refunded-invariant.spec.ts`, `refund.service.spec.ts` | Int + Unit | P0 |
| **School admin** | Approve/reject/suspend restaurants (scoped to own school, audited), refund queue, weekly metrics scoped to school | `journeys.int-spec.ts`, `refund.int-spec.ts`, `rbac.int-spec.ts` | Int | P1 |
| **Shop owner: menu** | Create/list/reprice/toggle; old orders keep the price they were placed at; validation (negative, zero, fractional price, empty/over-long name, unknown field → 400); duplicate name; delete never-ordered dish = real delete, ordered dish = archived (history intact, name reusable); other shop's menu untouchable | `journeys.int-spec.ts` | Int | P0 |
| **Shop owner: settings** | Cook pauses shop → orders blocked; resume; auto-accept toggle changes new orders | `journeys.int-spec.ts` | Int | P1 |
| **Cook queue** | Sees only own shop's orders; cannot read another shop's queue | `journeys.int-spec.ts`; browser: accept → student redirected to payment | Int + E2E | P0 |
| **Security** | See [`security.md`](security.md) | `security.int-spec.ts` | Int | P0 |
| **Resilience** | DB killed for 8 s mid-rush → 503 (never 500), process stays up, auto-recovery, no duplicate or half-built orders; pool exhaustion → 503 + `Retry-After`; frontend retries 429/503 for idempotent requests and yields exactly one order | `http-exception.filter.spec.ts`, k6 chaos run, `student-order.spec.ts` | Unit + Load + E2E | P0 |
| **Load** | Bell-time (2,520 orders in 60 s), retry storm, ramp, knee-finding, overload, soak | `load/lunch.js` | Load | P0 |

## Not covered (be aware)

- Coverage is **74.5 % lines / 48 % branches** for the integration suite (per-area numbers in `pilot-readiness.md`); the brief's 85 % / 80 % target was not reached.
- **Real Supabase Auth**: JWT signature/expiry verification happens inside Supabase and is not exercised. Test it once on staging.
- **Real Slip2Go / Firebase / S3**: mocked. Do one staging dry run with a real transfer and a real slip.
- **Browser E2E** covers three journeys (student order → shop accepts → payment page; school admin approval; access gates) — not shop registration, menu CRUD, ready/done, refunds or the payment slip upload in the UI. Those are covered at API level.
- `payout` read endpoints other than `/payout/weekly` (`GET /payout/:payoutId`) have no fixture-based test.
- No frontend unit/component tests exist in the repo; none were added.
- Soak: 10 minutes was run, not 30.

## Assumptions made where the spec was ambiguous

- "Cook" = `RestaurantRole.STAFF`; "shop owner" = `OWNER`; `ADMIN` (shop) is treated as a manager.
- Cooks (STAFF) may edit menus — confirmed intended; `docs/rbac-api-contract.md` is outdated on this.
- `POST /admin/schools/:id/invite-code/rotate` is documented as a sysadmin operation but the handler lacks `@SysadminWrite()`, so a sysadmin gets `SYSADMIN_READ_ONLY`. Not asserted either way.
- "PromptServe moves no money": the platform never holds funds; students pay the shop's PromptPay directly and the app verifies the slip. `PaymentStatus.REFUNDED` is set only when a school admin explicitly confirms a manual transfer.

## Commands

```bash
cd backend
npm run test:unit                 # jest (+ coverage gate: npx jest --coverage)
npm run test:int                  # integration, needs local Postgres (see below)
npm run test:int:cov              # + coverage gate
npm run test:security             # security + RBAC matrix only
npm run load:seed && npm run load:server &   # then:
SCENARIO=bell npm run test:load   # smoke | bell | retry | ramp | knee | spike | soak | mixed
npm run audit:prod

cd ../frontend
npm run test:e2e:prepare && npm run test:e2e
```

Local Postgres: any server on `localhost`; `.env.test` points at `localhost:55432/promptserve_test`. CI uses a service container.
