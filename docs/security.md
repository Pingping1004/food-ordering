# Security notes for the pilot

Scope: the NestJS API and the Next.js client for a one-school, ~2,500-student, one-month pilot. Tests referenced here are in `backend/test/integration/security.int-spec.ts` and `rbac.int-spec.ts` unless noted.

## What is worth protecting

| Asset | Why it matters | Main control |
|---|---|---|
| Student identity and orders | Minors' data; one student must never read or change another's order | Ownership checks (404 for others), school tenancy on every shop/menu/order route |
| Money flow (slips, payouts, refunds) | Students pay shops directly; the app verifies the slip and keeps the statement | Durable `Payout` table with a unique bank reference; idempotency keys; refund state machine with a single writer of `REFUNDED` |
| Shop owners' payout details | A PromptPay QR encodes the owner's phone/ID | Not returned to students (redacted); full details only to owner/sysadmin |
| Role boundaries (student / cook / owner / school admin / sysadmin) | Wrong access = tampering with prices, menus, approvals | Guards on every route; 119-route × 13-actor matrix test; sysadmin is read-only inside a school without a support grant |
| Availability at lunch | A broken app at 11:45 is the failure users notice | Per-user limiters, school-NAT-safe IP limits, 503 + `Retry-After` instead of crashes, durable idempotency |

## OWASP API Top 10 — how each is covered

| # | Risk | Status | Evidence |
|---|---|---|---|
| API1 | Broken object-level authorization | Covered | Matrix sends every id-taking route as the wrong actor with valid ids and a valid body; `GET /order/:id`, refunds, payments, memberships verified as owner-only |
| API2 | Broken authentication | Covered at the API edge | 401 for missing/garbage/wrong-scheme tokens; bearer-only (no cookies → no CSRF); real signature/expiry checking is **Supabase's** and is not exercised in tests (see "Not verified") |
| API3 | Broken object property-level authorization | Covered | Unknown/privileged fields on order creation → 400 and nothing created (`forbidNonWhitelisted`); owner cannot change role/status through shop PATCH; student cannot self-promote; student surface no longer carries shop payout fields |
| API4 | Unrestricted resource consumption | Fixed | Per-user caps (30 orders/min, 10 payments/5 min, 5 refunds/5 min, 240 req/min); JSON bodies 256 KB (10 MB only on `/payment/verify`); uploads capped at 8 MB/file and 30 files, and **authorization now runs before the file is buffered**; invite-code guessing throttled (failed attempts only) |
| API5 | Broken function-level authorization | Covered | Matrix + spot checks (staff cannot delete menus; pending cook cannot act; cook cannot approve self) |
| API6 | Unrestricted access to sensitive business flows | Covered | Order creation idempotent and rate-limited; one open refund per order; one slip pays one order; stock deduction atomic |
| API7 | Server-side request forgery | Not applicable | The API only calls fixed provider URLs (Slip2Go); no endpoint fetches a user-supplied URL |
| API8 | Security misconfiguration | Improved | helmet headers, CORS allow-list (foreign origin gets no CORS headers), no internals in 500 bodies, `DEBUG_ALWAYS_OPEN` ignored in production, `x-powered-by` removed |
| API9 | Improper inventory management | Covered | Route inventory is derived from the running app and compared with the matrix; `/health` (liveness) and `/ready` (DB) are the only public operational routes |
| API10 | Unsafe consumption of APIs | Partly | Slip2Go response is validated (code, timestamp window, duplicate reference); timeouts are 5 s; failures leave the order payable |

Injection: SQL/NoSQL/path/script payloads in ids and query values never produce a 5xx or a leak (Prisma parameterizes every query; `$queryRaw` is used only with bound parameters). Hostile text stored in menu names is returned as inert JSON with `nosniff`. XSS is a client concern: React escapes by default, and the only `dangerouslySetInnerHTML` in the client (`app/layout.tsx`) injects a constant text-size boot script, not user data.

## Findings fixed during this work

| Severity | Finding | Fix |
|---|---|---|
| **Critical** | Payment records lived in a per-process in-memory `Map`. After any restart or on a second instance, the same bank slip could pay for a second order and every shop's payment history vanished. | New durable `Payout` table; unique `transactionId` and `(idempotencyKey, orderId)`; races resolved by the database; backfill script for already-paid orders |
| **High** | Rate limits were per IP (30 orders/min, 500 requests/min). A school's Wi-Fi is one IP, so at the lunch bell **58 of 2,521 students (2.3%)** could order; everyone else got 429. | Per-user limiter after authentication; IP limits sized as a flood backstop only |
| **High** | Upload endpoints buffered up to 50 × 10 MB in memory **before** checking permission (any signed-in account could exhaust memory); menu uploads had no limits at all | Guards run before multer; 8 MB / 30-file caps everywhere |
| **High** | A file only had to be *named* `.png`; non-image content was stored with the client's content type (HTML served from the storage domain) | Extension **and** MIME check, case-insensitive; every stored image is decoded and re-encoded to WebP (content check); slip images validated by magic bytes before the paid API is called |
| **High** | Every student received every shop's bank account number/name, PromptPay QR URL, bank type and e-mail from the shop list/detail endpoints | Removed for non-members; members keep the masked view they had |
| **High** | Dependency vulnerabilities: `proxy-addr` (critical), `multer`, `@grpc/grpc-js`, `sharp`/libvips/libheif/librsvg CVEs (the server decodes untrusted images) | `npm audit fix` + `sharp@0.35.5`; backend now has **0 high/critical** (10 moderate remain, transitive) |
| Medium | Accept/accept and accept/reject races double-deducted or stranded stock | Row lock per order for every transition |
| Medium | Error filter returned raw internal messages for unexpected errors, turned middleware 4xx into 500, wrote two stack traces per ordinary 4xx, and contained `onmessage = …` (assignment to a global) | Rewritten; generic 500s, pass-through 4xx, one-line warns |
| Medium | `DEBUG_ALWAYS_OPEN=true` (present in `.env`) makes closed shops orderable | Ignored when `NODE_ENV=production`; remove it from the file anyway |
| Medium | `uncaughtException`/`unhandledRejection` called `process.exit(1)` immediately | Rejections are logged; uncaught exceptions drain requests, then exit |
| Low | Payment page crashed (blank error screen) on a malformed QR URL | Fail-safe `<img>` with a message |

## Residual risks — decide before launch

1. **Database TLS is not verified** (`ssl: { rejectUnauthorized: false }` for any non-local host). Traffic is encrypted but the server certificate is not checked, so a network attacker between the API and the database could impersonate it. Supply the provider's CA and enable verification.
2. **`trust proxy = 1`** is correct only with exactly one proxy hop (e.g. Render). A second hop (Cloudflare in front of Render) makes `req.ip` wrong and the IP limiter meaningless; per-user limits still hold.
3. **Rate limits and caches are per process.** With more than one API instance every limit is multiplied by the instance count, and a shop/school suspension is seen by the other instances' read paths only after the 5 s visibility cache expires (order creation always reads fresh). Fine for a single instance; add Redis before scaling out.
4. **Frontend dependencies**: 11 high advisories (Next/PostCSS, Firebase, Sentry plugins) need major-version bumps. They are build/transitive for the most part; schedule an upgrade, don't `npm audit fix --force` blindly.
5. **Secrets hygiene**: no `.env*` with real values is tracked (checked history). `backend/cert/localhost*.pem` (dev TLS key) and an empty `backend/dump.sql` are tracked — untrack them.
6. **Supabase service-role key** is used by the API for account deletion; keep it server-side only and rotate if it was ever shared.
7. **Student contact phone numbers are optional on orders and visible to the shop** by design. The shop's own phone is shown to students by design.

## Not verified here

- Supabase's JWT verification, expiry and TOTP (`aal2`) enforcement for sysadmins (the tests model `aal2` through the token's claim).
- Real Slip2Go semantics (the tests assert what the app *sends* and how it reacts to each response shape).
- Firebase push delivery and S3 permissions/bucket policy (objects are uploaded `public-read`; confirm the bucket does not allow listing).
