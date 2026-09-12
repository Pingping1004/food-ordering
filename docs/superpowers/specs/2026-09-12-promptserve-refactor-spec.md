# PromptServe Refactor — Project Specification

> **Status:** Approved for implementation
> **Date:** 2026-09-12
> **Branch:** `production`
> **Scope:** Domain/data-model refactor of the existing food-ordering codebase
> **Goal:** A coherent, production-ready foundation deployable to a real pilot school

---

## 1. Objective

Refactor the existing PromptServe application so that the **domain model, data layer, service layer, DTOs, and frontend types form a consistent, reliable system** — without rewriting the product, redesigning the UI, or adding unvalidated features.

The output is not a new application. It is the **same application made internally coherent**, so that:
- The Prisma schema accurately represents the domain.
- DTOs, frontend types, and backend models agree.
- Business rules are enforced server-side in the right place.
- Critical flows (Restaurant → Menu → Order) are robust and testable.
- School/cafeteria capabilities can be added later on a clean foundation.

The `IDEA.md` in the repo root is the strategic source of truth for what PromptServe is and why it exists. This spec is the tactical document for making the codebase match that vision.

---

## 2. Guiding Principles

1. **Correctness first.** The system must do the right thing for real users before it is clever.
2. **Refactor the foundation, don't expand the product.** No speculative features.
3. **Keep working UX unless there is a concrete reason to change it.**
4. **Strong typing everywhere it reduces ambiguity.**
5. **One place for each important rule.** Availability logic, status transitions, price integrity, and payment state rules should each live in a clearly owned location.
6. **KISS + DRY + SOLID + YAGNI.** No 15-abstraction architectures.
7. **Plan migrations explicitly.** Any schema change that affects data must have a clear migration story.
8. **Tests for risk, not coverage theater.** Test the things that break pilots.

---

## 3. In Scope

### 3.1 Fix Critical Reliability Issues (do first)

These are blockers for any pilot. Fix them before or as part of the broader refactor.

1. **OrderMenu field mismatch.** `OrderService.createOrder` passes `maxDaily` and `details` to `OrderMenu.create`, but the Prisma `OrderMenu` model has neither field. This should cause runtime Prisma validation errors during order creation. Either add the fields to the schema if they are needed, or remove them from the create payload.

2. **Accept/reject authorization.** `OrderController.acceptOrder` and `OrderController.rejectOrder` are `@Public()` endpoints with no restaurant ownership check. Any authenticated user can accept or reject any order. Add a check that the caller is associated with the restaurant that owns the order (via `Restaurant.userId` or a membership/role check).

3. **Open/closed check on order creation.** `OrderService.validateTimingAndQueue` checks delivery time buffer and active order count, but does NOT verify the restaurant is currently open. A user can place an order for a closed restaurant. Add an open/closed check using the centralized availability logic (see §3.2).

4. **`removeOrder` logic is inverted.** The service checks `order.status !== OrderStatus.accepted` and throws if the order is NOT accepted — meaning only accepted orders can be deleted, which is backwards. Either fix the condition or remove the endpoint if deletion is not a supported operation.

### 3.2 Centralize Operating Hours / Business Dates

Replace the current scattered time-check logic with a single coherent model.

**Current state:**
- `RestaurantService` has private `isTimeBetween()` and `isTodayOpen()` methods.
- These are duplicated between `findRestaurant()` and `getOpenRestaurants()`.
- `OrderService` does not check if a restaurant is open when creating an order.
- The model is: `openDate: DateWeek[]`, `openTime: String`, `closeTime: String`, `isTemporarilyClosed: Boolean`.
- No support for special dates, holidays, per-day override hours, or "currently accepting orders" as a first-class concept.

**Target state:**
- A centralized `AvailabilityService` (or equivalent) that owns all open/closed logic.
- Can answer: "Is this restaurant open now?" and "Is this restaurant open at a given date/time?"
- Can answer: "Can this restaurant accept a new order right now?" (open + not temporarily closed + within active order capacity, if applicable).
- Used by both `RestaurantService` (for display) and `OrderService` (for order validation).
- Schema may be extended to support special dates / overrides if the pilot requires it, but the minimum is a clean in-code model over the existing fields.

**Design constraint:** Do not over-model. Start with a service that encapsulates the existing field semantics cleanly. Add schema fields only when a real pilot requirement demands them (e.g. special holiday closures).

### 3.3 Align Restaurant Module

1. **Schema/DTO alignment:**
   - Fix `CreateRestaurantDto.openTime`/`closeTime` — currently `@IsDate()` but stored as String. Make the DTO type match the storage format (string in HH:mm) or convert cleanly in the service.
   - Remove dead fields from `UpdateRestaurantDto`: `password`, local `Role` enum.
   - Confirm `accountNumber` and `bankAccount` are required at creation (they are required in Prisma but optional in DTO — the service fills them from QR extraction, but the DTO should reflect the requirement or the fallback must be guaranteed).

2. **Service ownership:**
   - Restaurant open/closed state is owned by the availability service (§3.2).
   - Restaurant configuration (auto-accept, temporary close, admin details, payment account) stays in `RestaurantService`.
   - Remove the duplicated open/closed computation from `getOpenRestaurants()` — delegate to the availability service.

3. **Typing:**
   - `RestaurantCache` interface should reflect the actual Prisma model fields.
   - `OpenRestaurant` type adds open/closed computation results — keep this, but ensure it's computed by the availability service, not duplicated.

### 3.4 Align Menu Module

1. **Schema/DTO alignment:**
   - `CreateMenuDto.price` is `number`, `UpdateMenuDto.price` is `string` with regex. Make both consistent — prefer `number` on both sides, formatted at the API boundary if needed.
   - Remove dead field `UpdateMenuDto.role`.
   - `CreateMenuDto` does not include `menuImg` — the service handles it via file upload. This is acceptable but should be documented/understood as a deliberate pattern, not accidental.

2. **Service ownership:**
   - Menu availability (`isAvailable`) and price integrity are owned by `MenuService`.
   - Display price calculation (markup + commission) is owned by `MenuService`.
   - `OrderService.validateOrderMenus` should delegate price/availability checks to `MenuService` rather than re-implementing them.

3. **Type alignment:**
   - Frontend `Menu` type includes `sellPriceDisplay`, `isOrderable`, `price`, `cookingTime`. Backend `MenusWithDisplayPrices` includes `sellPriceDisplay`, `platformFeeDisplay`, `isOrderable`. Align these so frontend types are generated or kept in sync with the backend response shape.
   - `CreateMenuInput` frontend type should not include display-only fields.

### 3.5 Align Order Module

1. **Schema/DTO alignment:**
   - Add `details` and `maxDaily` to `OrderMenu` Prisma model if the business needs them persisted on the order line item. If not, remove them from the create payload in `OrderService.createOrder`.
   - Add `paymentMethod` to `CreateOrderDto` if orders need to record the payment method at creation. If payment method is set later (during payment verification), document this clearly.
   - `Order.paymentMethod` in Prisma is `String?` mapped from `payment_method_type`. Consider using the `PaymentMethod` enum instead of a raw string.

2. **Order lifecycle / status transitions:**
   - The transition table in `updateOrderStatus` is good. Keep it. Make it the single source of truth for allowed transitions.
   - `cancelOrder` (user-initiated) and `updateOrderStatus` (restaurant-initiated) both handle cancellation but through different paths. Ensure the rules are consistent and the paths don't conflict.
   - Consider extracting the transition table into a shared constant or small validation function so it can be reused and tested independently.

3. **Idempotency:**
   - Order creation currently has no idempotency key. For a pilot, consider adding one (e.g. client-generated order request ID) to prevent duplicate orders from double-submissions.
   - The payment verification flow already has idempotency via `idempotencyKey` + `requestHash` on payouts. This is good; keep it.

4. **Payment state consistency:**
   - `Payout.vat` is hardcoded to `new Decimal(0)` in `updatePayoutTx` despite `calculatePayout` computing a vatRate. Either persist the calculated vat or remove the field if it's not used.
   - `PayoutService.updatePayoutTx` recalculates payout values that were already calculated in `PaymentService.verifyPayment`. This is redundant but not harmful. Consider passing the precomputed values to avoid double calculation.

5. **PaymentMethod enum wiring:**
   - The `PaymentMethod` enum exists in Prisma but `Order.paymentMethod` is a raw String. Wire it to the enum.

### 3.6 Webhook Endpoint

1. Decide whether the `/api/payment/webhook` endpoint is needed.
   - If Omise webhooks are expected: implement the handler, verify the signature, and process the webhook event. Currently the endpoint is configured (raw body parsing in `main.ts`) but no controller handles it.
   - If Omise webhooks are NOT expected: remove the raw body parsing configuration and the Omise config from `configuration.ts`, and remove the `omise` package from `package.json` if it's unused.
   - Either way, resolve the ambiguity. A configured but unused webhook endpoint is confusing and potentially risky.

### 3.7 Cross-Cutting Cleanup

1. **Error handling:**
   - Remove debug `console.log` statements from production code (`expireOrder`, `analytics.trackOrderEvent`).
   - Ensure error responses are consistent in shape. The global `HttpExceptionFilter` handles this, but individual services sometimes throw raw errors vs `HttpException` subclasses inconsistently.

2. **Validation consistency:**
   - Frontend and backend time buffer: frontend Zod uses `6 + avgCookingTime`, backend uses `avgCookingTime + 3 + 3`. Same total, but if the backend windows change, the frontend will drift. Consider sharing the window constants or generating frontend validation from backend config.

3. **Naming:**
   - Fix typo: `updateIsTemporailyClose` → `updateIsTemporarilyClose`.
   - Remove or rename the local `Role` enum in `UpdateRestaurantDto` that shadows the Prisma `Role` enum.

4. **Logging:**
   - Add structured logging for high-risk operations: order creation, payment verification, status transitions. The current `Logger` usage is inconsistent — some services log well, others don't log key events.

### 3.8 Prototype / Dead Code Cleanup

1. Remove unused DTO fields identified in §3.3, §3.4, §3.5.
2. Remove the `omise` package if it's not used (see §3.6).
3. Remove any other dead code identified during implementation, conservatively.
4. Do NOT clean up code that supports a live workflow without confirming it first.

---

## 4. Out of Scope

- UI redesign or visual refresh.
- Rewriting the application in another framework.
- Adding customer authentication just because it would be cleaner.
- Building the school executive dashboard.
- Building complex vendor-management infrastructure.
- Adding WebSockets to replace polling.
- Adding Redis without a demonstrated need.
- Introducing React Query / Zustand solely for architectural fashion.
- Replacing working payment infrastructure (Slips2Go) without a concrete reason.
- Rewriting everything from scratch.
- Adding features not validated by pilot conversations or evidence.

---

## 5. Implementation Order

The refactor must keep the system working at every step. Recommended order:

1. **Fix critical issues** (§3.1) — these are small, high-impact, and make the system safe to work on.
2. **Centralize availability logic** (§3.2) — foundational; order validation and restaurant display both depend on it.
3. **Restaurant module alignment** (§3.3) — schema, DTOs, service, using the availability service.
4. **Menu module alignment** (§3.4) — schema, DTOs, service, type alignment.
5. **Order module alignment** (§3.5) — schema fixes, status transitions, idempotency, payment state, authorization.
6. **Webhook decision & cleanup** (§3.6) — resolve the Omise/webhook ambiguity.
7. **Cross-cutting cleanup** (§3.7) — error handling, logging, naming, validation consistency.
8. **Prototype cleanup** (§3.8) — remove dead code, unused deps.
9. **Verification** — confirm critical paths work, existing flows unbroken, tests pass.

---

## 6. Critical Paths to Preserve

At every step, verify these flows still work:

1. **Place order** — student creates an order, it appears in the restaurant queue.
2. **Restaurant accepts order** — restaurant accepts, order moves to accepted, inventory deducted.
3. **Payment verification** — student uploads slip, slip verified, order marked paid, payout created.
4. **Order completion** — order auto-completes after deliverAt + buffer, or restaurant marks ready/completed.
5. **Order cancellation** — user cancels within window, order cancelled.
6. **Restaurant open/closed display** — frontend shows correct open/closed state for restaurants.
7. **Authentication/authorization** — only authorized users can access protected endpoints.

---

## 7. Definition of Done

The refactor is done when:

- The Prisma schema accurately represents the domain and has no field mismatches with the service layer.
- DTOs, service contracts, and frontend types are consistent across Restaurant, Menu, and Order.
- Business rules for availability, price integrity, order lifecycle, and payment state are enforced server-side in clearly owned services.
- Order creation is safe (no runtime Prisma errors from field mismatches) and checked for restaurant open status.
- Accept/reject endpoints are properly authorized.
- Payment/order state handling is reliable and consistent.
- Availability logic is centralized and not duplicated.
- Dead DTO fields and unused dependencies are removed.
- Debug logging is removed from production paths.
- The critical paths in §6 still work.
- The codebase is coherent enough that deploying to a pilot school does not feel like deploying a pile of MVPs.

---

## 8. Reference Documents

- **IDEA.md** (repo root) — strategic vision and product thesis.
- **Baseline report** — `docs/superpowers/refactor/ticket-0-baseline.md` — detailed findings from the production branch audit.
- **Current codebase** — `backend/` and `frontend/` in this repo.

---

*End of spec.*
