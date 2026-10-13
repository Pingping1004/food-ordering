# PromptServe Refactor — Project Specification

> **Status:** Draft — pending user review
> **Date:** 2026-09-12
> **Branch:** `production`
> **Scope:** Reconcile the Prisma schema with the application code, fix domain model inconsistencies, and establish a coherent foundation for pilot deployment.

---

## 1. Objective

The `production` branch contains a working food-ordering MVP, but the Prisma schema and the application code have diverged during rapid development. The schema cannot generate a client that matches the code. This spec describes the refactor needed to make the codebase internally coherent so it can be deployed to a pilot school with confidence.

**Success = the Prisma schema, DTOs, services, and frontend types all agree on one domain model.**

---

## 2. What Is Out of Scope

- UI redesign or frontend reworking (unless required by a schema change)
- Rewriting the payment flow from scratch (Slip2Go/Omise integration stays as-is, just made coherent)
- Adding school/canteen infrastructure that is not yet wired to the actual restaurant flow
- Adding new features not required for pilot reliability
- Changing the general architecture (NestJS + Next.js + Prisma stays)

---

## 3. Domain Model Reconciliation

### 3.1 Order Lifecycle

**Problem:** The schema defines `OrderStatus` as `receive | cooking | ready | done | delay | rejected`. The code uses `sent | accepted | cancelled | rejected | completed`. These are two different state machines.

**Decision needed:** Which lifecycle is correct for the pilot?

The code's lifecycle looks like:
```
sent → accepted → completed
  ↓         ↓
rejected   cancelled
```
with `delay` as a flag on accepted orders.

The schema's lifecycle looks like:
```
receive → cooking → ready → done
  ↓
delay / rejected
```

**Recommendation:** Adopt the code's lifecycle (`sent / accepted / completed / cancelled / rejected`) because:
- It matches what the frontend and services already implement
- It has explicit transition validation in `OrderService.updateOrderStatus`
- It separates the "accepted but not yet completed" state clearly

**Required changes:**
- Update `OrderStatus` enum in schema to: `SENT | ACCEPTED | COMPLETED | CANCELLED | REJECTED`
- Remove `delay` as a status; keep it as a boolean flag (`isDelay`) on Order
- Update all code that references the old enum values
- Ensure `OrderService.updateOrderStatus` transition table matches the new enum

### 3.2 OrderMenu Model

**Problem:** Schema has `unitPrice: Int` and `totalPrice: Int`. Code treats `unitPrice` as `Decimal` and passes `maxDaily` in the `OrderMenu.create` payload. `details` is on `Order` in schema but code passes it inside `OrderMenu.create`.

**Required changes:**
- `OrderMenu.unitPrice` → `Decimal @db.Decimal(10,2)` (matches code's `Decimal` usage)
- Add `maxDaily: Int` to `OrderMenu` (the code already sends it)
- Remove `totalPrice` from `OrderMenu` (code doesn't use it; total is on `Order`)
- Move `details` from `Order` to `OrderMenu` (code passes it per-menu-item)
- Ensure `OrderService.createOrder` creates `OrderMenu` with the correct fields

### 3.3 PaymentStatus

**Problem:** Schema uses `PENDING_VERIFICATION | UNPAID | PAID | FAILED | CANCELLED | REFUNDED`. Code uses lowercase `unpaid / paid / verifying / failed` and treats `verified` as a gateway status string.

**Required changes:**
- Align `PaymentStatus` enum to the values the code actually uses
- Recommended: `UNPAID | PAID | VERIFYING | FAILED`
- Remove `PENDING_VERIFICATION` (code never uses it), `CANCELLED`, `REFUNDED` (not yet implemented)
- Make `paymentGatewayStatus` a clear separate field for gateway-specific status like `verified`
- Ensure `PaymentService` and `OrderService` use the enum values, not free-form strings

### 3.4 Restaurant Operating Model

**Problem:** The schema has `RestaurantOperatingHour` and `CanteenOperatingHour` models, but `Restaurant` itself doesn't have `openTime`, `closeTime`, `openDate`, `isTemporarilyClosed`, `isApproved`, `paymentQr`, `accountNumber`, `bankAccount`, `accountHolderFullName`. Yet `RestaurantService` reads and writes all of these.

**Decision needed:** Where should operating hours live?

Two viable designs:

**Option A — Restaurant carries its own hours (simpler, matches current code):**
- Add to `Restaurant`: `openTime String`, `closeTime String`, `openDate String[]` (day names), `isTemporarilyClosed Boolean`, `isApproved Boolean`
- Keep `RestaurantOperatingHour` only if/when per-day override hours are needed
- Add payment fields: `paymentQr String`, `accountNumber String`, `bankAccount String`, `accountHolderFullName String`
- `RestaurantService` already works this way — minimal changes

**Option B — Hours strictly on operating-hour models (cleaner long-term):**
- Remove loose fields from Restaurant
- Use `RestaurantOperatingHour` for regular hours, `SchoolDateOverride`-like model for special closures
- Add a service layer that computes "is open now" from the operating-hour models
- More work, cleaner model, better for multi-location/canteen scenarios

**Recommendation:** Option A for the pilot. It matches the existing code, is simpler, and gets the system deployable faster. Option B can be a later refinement once the pilot validates the need.

**Required changes (Option A):**
- Add missing fields to `Restaurant` model
- Ensure `RestaurantService` reads/writes match the schema
- Create a single `RestaurantOpenService` or add methods to `RestaurantService` that answer:
  - `isOpenNow(restaurantId)` — is the restaurant open right now?
  - `canAcceptOrders(restaurantId)` — is it open AND not temporarily closed AND within active order limits?
- Use this service in `OrderService.validateTimingAndQueue` and menu display

### 3.5 RestaurantMembership and User Model

**Problem:** Schema has `RestaurantMembership` (userId + restaurantId + role) and `User` has `restaurantMemberships`. Code references `isOwner` checks but the exact ownership verification path needs to be clear.

**Required changes:**
- Ensure ownership checks in `OrderService` and `MenuService` use `RestaurantMembership` or `Restaurant.userId` consistently
- Decide: is the restaurant owner the `User` referenced by `Restaurant.userId`, or a user with `RestaurantMembership` role `OWNER`?

### 3.6 Payout and Payment Models

**Problem:** `Payout` model exists in schema. Code has `PaymentService` (Slip2Go verification) and `PayoutService` (creating payouts). The relationship between order payment verification and payout creation needs to be a single clear flow.

**Required changes:**
- Ensure `PaymentService.verifyPayment` creates both the payment status update on Order AND the Payout record in one transaction
- Ensure `PayoutService` is the single place payout records are created/updated
- Remove any duplicate payout creation logic

---

## 4. DTO and Validation Alignment

### 4.1 CreateOrderDto / CreateOrderMenusDto

**Problem:** `CreateOrderMenusDto` sends `unitPrice` and `maxDaily`, but the schema's `OrderMenu` doesn't have `maxDaily`. `details` is sent per-menu but stored on Order in schema.

**Required changes:**
- Make DTO fields match the final schema after 3.1 and 3.2
- Ensure `CreateOrderDto` validation matches what the service actually needs
- Price validation: should the frontend send price, or should the backend look it up from Menu? The code looks up the menu and validates price — this is correct. Ensure DTO doesn't trust frontend price.

### 4.2 CreateRestaurantDto / UpdateRestaurantDto

**Required changes:**
- Add validation for new Restaurant fields (`openTime`, `closeTime`, `openDate`, payment fields, `isTemporarilyClosed`)
- Ensure DTO types match schema field types (String vs Int vs Boolean)
- Remove any DTO fields that don't map to schema fields

### 4.3 Menu DTOs

**Required changes:**
- Ensure `CreateMenuDto` and `UpdateMenuDto` match the final Menu schema
- Price should be validated as a number the backend can store as Int (or Decimal if changed)

---

## 5. Service Layer Fixes

### 5.1 OrderService

- Fix `createOrder` to create `OrderMenu` with correct fields matching final schema
- Fix `updateOrderStatus` transition table to match final `OrderStatus` enum
- Fix `countActiveKitchenOrders` to use final status values
- Ensure `updateOrderPaymentTx` uses final `PaymentStatus` enum
- Add open/closed check to `validateTimingAndQueue` (use the centralized open service from 3.4)
- Remove `details` from OrderMenu create (it goes on OrderMenu after 3.2, or stays on Order — whichever is decided)

### 5.2 RestaurantService

- Fix `findRestaurant` to read fields that actually exist on Restaurant after schema update
- Fix `createRestaurant` to write all required fields
- Fix `updateIsTemporailyClose` naming (typo: "Temporaily" → "Temporarily")
- Add `isOpenNow` / `canAcceptOrders` methods (or delegate to new open service)
- Ensure `getOpenRestaurants` uses the centralized open check

### 5.3 MenuService

- Fix `getRestaurantMenusDisplay` and other methods to use correct Menu model fields after schema update
- Fix price display calculation if `Menu.price` type changes
- Ensure menu availability check is consistent with restaurant open status

### 5.4 PaymentService

- Align payment status strings with final `PaymentStatus` enum
- Ensure webhook handler (if it exists) updates order and payout in a transaction
- Clarify the relationship between `paymentStatus` (enum) and `paymentGatewayStatus` (string)

---

## 6. Schema Migration Plan

Since the database is disposable, the migration can be done as a full reset:

1. Write the corrected schema
2. Generate Prisma client
3. `prisma db push` or `prisma migrate dev` to apply
4. Verify the generated client types match the code

If any production data exists that must be preserved, use `prisma migrate dev` with explicit migration steps. Given the schema-comment in the file mentions Supabase (`postgresql://postgres.njavdwcapqmsdbytyspd:***@aws-1-ap-southeast-1.pooler.supabase.com`), there may be a real database — check before wiping.

---

## 7. Testing Strategy

### Unit tests to add/fix:
- `OrderService.validateOrderMenus` — price calculation, menu existence, availability check
- `OrderService.updateOrderStatus` — transition validation (allowed and rejected transitions)
- `RestaurantService.isOpenNow` / `canAcceptOrders` — various open/closed scenarios
- `PaymentService` — payment status transitions

### Integration checks:
- Full order creation flow: DTO → service → database (verify all fields map correctly)
- Full payment verification flow: slip upload → verification → order paid → payout created
- Restaurant order management: accept → complete, accept → reject

---

## 8. 프론트엔드 영향 (Frontend Impact)

The frontend may need changes if:
- Order status enum values change (frontend displays status strings)
- Menu/Order DTO shapes change
- Price calculation changes (if Menu.price becomes Decimal)

Frontend changes should be minimal and driven by backend schema changes, not independent redesign.

---

## 9. Rollout Plan

1. **Phase 1: Schema reconciliation** — Write the corrected Prisma schema, generate client, verify it compiles with the existing code (fixing compilation errors as needed)
2. **Phase 2: Service fixes** — Fix service layer to use the corrected schema and enums
3. **Phase 3: DTO alignment** — Ensure DTOs match the final schema
4. **Phase 4: Open/closed centralization** — Create single source of truth for restaurant open status
5. **Phase 5: Testing** — Verify critical flows work end-to-end
6. **Phase 6: Pilot readiness review** — Confirm the system can be deployed

---

## 10. Risks

- **Data loss:** If the Supabase database has real data, `prisma db push --force` or a fresh migrate could destroy it. Verify before resetting.
- **Enum mismatch ripple:** Changing `OrderStatus` affects every service, controller, DTO, frontend component, and database row. Must update all references.
- **Payment flow correctness:** Changing `PaymentStatus` values could break the Slip2Go webhook handler if it expects specific values. Verify the webhook handler's expectations.
- **Timezone handling:** The code uses `moment-timezone` with `Asia/Bangkok`. Ensure any new open/closed logic respects the same timezone.

---

## 11. Definition of Done

- [ ] Prisma schema generates a client that compiles with all existing code
- [ ] All `OrderStatus` references in code use the same enum values as the schema
- [ ] All `PaymentStatus` references in code use the same enum values as the schema
- [ ] `OrderMenu` create payload matches the schema fields exactly
- [ ] `Restaurant` model has all fields the service layer needs
- [ ] There is one authoritative way to check if a restaurant is open
- [ ] Order creation flow works end-to-end without Prisma field errors
- [ ] Payment verification flow works end-to-end without status mismatches
- [ ] DTOs validate what the service expects and nothing more
- [ ] No prototype/dead models left in the schema that are not wired to the application
- [ ] Critical flows have at least basic test coverage
