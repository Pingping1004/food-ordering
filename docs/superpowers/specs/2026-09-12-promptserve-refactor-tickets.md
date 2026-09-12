# PromptServe Refactor — Task Tickets

> Companion to: `docs/superpowers/specs/2026-09-12-promptserve-refactor-spec.md`
> Branch: `production`
> Status: Approved for implementation

---

## Ticket 0 — Read and confirm current state

**Type:** Discovery  
**Depends on:** nothing  
**Blocks:** everything else

- Read the current Prisma schema and annotate it field by field.
- Read all DTOs in Restaurant, Menu, Order, Payment, Payout modules.
- Read all services in the same modules.
- Read the controllers to understand what's exposed.
- Read frontend types and schemas.
- Identify all mismatches, dead fields, gaps, and inconsistencies.
- Record the baseline in `docs/superpowers/refactor/ticket-0-baseline.md`.
- Identify the critical paths that must keep working.

**Deliverable:** Written baseline report. No code changed.

---

## Ticket 1 — Fix OrderMenu field mismatch

**Type:** Bug fix  
**Depends on:** Ticket 0  
**Blocks:** Ticket 5

- Verify the actual mismatch between `OrderService.createOrder` and the `OrderMenu` Prisma model.
- If `details` is needed on line items: add `details String?` to `OrderMenu` schema.
- If `maxDaily` is already in the schema: verify no other unknown fields are passed.
- If no mismatch exists: document it as a false alarm.
- Run a test order creation to confirm no runtime Prisma errors.

**Deliverable:** Order creation works without Prisma field errors.

---

## Ticket 2 — Fix accept/reject authorization

**Type:** Security fix  
**Depends on:** Ticket 0  
**Blocks:** Ticket 5

- Determine how to check if a caller is authorized for a restaurant (owner `userId`, membership, role).
- Add authorization to `updateOrderStatus` for accept and reject transitions.
- Unauthorized accept/reject returns 403.
- Keep or add `@UseGuards(JwtAuthGuard)` to the accept/reject endpoints as needed.
- Verify with a test: unauthorized user cannot accept/reject another restaurant's order.

**Deliverable:** Accept/reject protected by restaurant ownership check.

---

## Ticket 3 — Fix removeOrder logic

**Type:** Bug fix  
**Depends on:** Ticket 0  
**Blocks:** nothing

- Decide intended behavior: only completed orders deletable? No deletion? Non-terminal states only?
- Fix the condition or remove the endpoint.
- Update error message to match behavior.
- Check if frontend uses this endpoint; remove if unused.

**Deliverable:** Correct removeOrder behavior or endpoint removed.

---

## Ticket 4 — Add open/closed check to order creation

**Type:** Bug fix + foundation  
**Depends on:** Ticket 0  
**Blocks:** Ticket 6

- Add a check in `OrderService.validateTimingAndQueue` (or `createOrder`) that rejects orders for closed restaurants.
- Use `RestaurantService.findRestaurant()` to get the open status for now.
- Throw a clear error if the restaurant is closed.
- Decide fail-closed (block the order) for pilot safety.

**Deliverable:** Orders for closed restaurants are rejected.

---

## Ticket 5 — Centralize availability logic

**Type:** Refactor  
**Depends on:** Ticket 4  
**Blocks:** Tickets 7, 8

- Create `AvailabilityService` with public methods:
  - `isRestaurantOpen(restaurant): boolean`
  - `canAcceptOrder(restaurantId): boolean`
- Move `isTimeBetween` and `isTodayOpen` from `RestaurantService` into this service.
- Update `RestaurantService.findRestaurant` and `getOpenRestaurants` to use the new service.
- Update `OrderService` to use the new service for the open/closed check.
- Add tests for: normal hours open, normal hours closed, overnight open, overnight closed, temporarily closed, edge cases.

**Deliverable:** Single source of truth for restaurant open/closed logic. No duplication.

---

## Ticket 6 — Align Restaurant module (schema + DTOs + service)

**Type:** Domain alignment  
**Depends on:** Ticket 5  
**Blocks:** Ticket 7

- Fix `CreateRestaurantDto.openTime`/`closeTime`: change from `@IsDate()` to string format validator matching Prisma String storage.
- Remove dead fields from `UpdateRestaurantDto`: `password`, local `Role` enum.
- Resolve `accountNumber`/`bankAccount` required vs optional: guarantee the QR fallback or make them required in DTO.
- Remove `Restaurant.location` from schema if confirmed unused.
- Remove duplicated open/closed computation from `RestaurantService` (now in AvailabilityService).
- Align `RestaurantCache` and `OpenRestaurant` types with actual Prisma model.
- Rename `updateIsTemporailyClose` → `updateIsTemporarilyClose`.
- Add test for restaurant creation with QR fallback.
- Add test for temporarily-closed toggle.

**Deliverable:** Restaurant module coherent: DTOs match schema, dead fields gone, service uses availability service.

---

## Ticket 7 — Align Menu module (schema + DTOs + service + types)

**Type:** Domain alignment  
**Depends on:** Ticket 6  
**Blocks:** Ticket 8

- Make `UpdateMenuDto.price` a `number` to match `CreateMenuDto.price`.
- Remove dead field `UpdateMenuDto.role`.
- Verify `Menu.menuImg` nullability and fallback handling.
- Extract menu validation (availability, price, ownership) into `MenuService` and have `OrderService.validateOrderMenus` delegate to it.
- Align frontend `Menu` type and `CreateMenuInput` with backend response shape. Remove display-only fields from creation types.
- Verify markup rate consistency between `MenuService.calculateDisplayPrice` and `OrderService.validateOrderMenus`.
- Add test for menu creation with duplicate name rejection.
- Add test for price validation.

**Deliverable:** Menu module coherent: DTOs consistent, service owns menu rules, frontend types aligned, price calculation consistent.

**⚠️ Risk:** Price mismatch between display and charge is a pilot-killer. Verify the full flow carefully.

---

## Ticket 8 — Align Order module (schema + DTOs + service + state machine)

**Type:** Domain alignment — highest risk  
**Depends on:** Ticket 7  
**Blocks:** Ticket 9, 10

- Confirm `OrderMenu` schema is correct (Ticket 1 should have resolved any mismatch).
- Wire `Order.paymentMethod` to the `PaymentMethod` enum instead of raw String.
- Add `paymentMethod` to `CreateOrderDto` if needed at creation time, or document that it's set during payment.
- Extract `ORDER_TRANSITIONS` into a shared constant/validation function.
- Ensure `cancelOrder` uses the same transition rules as `updateOrderStatus`.
- Add test for transition table: allowed transitions work, disallowed are rejected.
- Add idempotency key to order creation (store on Order, check for duplicates) OR document why it's deferred.
- Fix `Payout.vat`: persist calculated vat or remove the field.
- Consider passing precomputed payout values to `PayoutService.updatePayoutTx`.
- Ensure `cancelOrder` checks order ownership (via `orderSecret` or user relationship).
- Review `updateDelay` 10-min window and deliverAt extension.
- Review cron jobs: `autoCompleteOrders` (10-min buffer), `autoRejectedOrder` (3-min timeout), `expireOrder` (3-min payment timeout). Verify no conflicts.
- Add tests for: status transitions, order creation idempotency (if implemented), payment state flow.

**Deliverable:** Order module coherent: schema matches domain, transitions centralized and tested, payment state consistent, authorization correct.

**⚠️ Risk:** Highest-risk ticket. Test every change against critical paths. Stop and restore if anything breaks order placement, payment, or completion.

---

## Ticket 9 — Webhook decision & cleanup

**Type:** Decision + cleanup  
**Depends on:** Ticket 8  
**Blocks:** Ticket 10

- Decide: are Omise webhooks expected?
  - If YES: implement webhook handler with signature verification. Process charge events and update order/payment state. Add test with mocked Omise event.
  - If NO: remove raw body parsing from `main.ts`, remove Omise config from `configuration.ts`, remove `omise` from `package.json` if unused elsewhere.
- Document the decision in the codebase.

**Deliverable:** Webhook endpoint either implemented or removed. No ambiguity.

---

## Ticket 10 — Cross-cutting cleanup

**Type:** Cleanup + quality  
**Depends on:** Ticket 9  
**Blocks:** Ticket 11

- Remove `console.log` from `OrderService.expireOrder` and `AnalyticsService.trackOrderEvent`.
- Rename `updateIsTemporailyClose` → `updateIsTemporarilyClose` everywhere.
- Remove local `Role` enum from `UpdateRestaurantDto`.
- Audit services for raw `Error` throws vs `HttpException` subclasses. Prefer specific exception types.
- Add structured logging to `OrderService.createOrder` and `PaymentService.verifyPayment` for key events.
- Align frontend/backend time buffer constants. Share or document sync requirement.
- Review all DTOs for missing validation decorators.

**Deliverable:** Cleaner codebase: no debug logging, consistent naming, better error handling, structured logging for pilot diagnosis, consistent validation.

---

## Ticket 11 — Prototype / dead code cleanup

**Type:** Cleanup  
**Depends on:** Ticket 10  
**Blocks:** Ticket 12

- Remove `omise` from `package.json` if confirmed unused (Ticket 9).
- Remove dead DTO fields: `UpdateRestaurantDto.password`, local `Role` enum, `UpdateMenuDto.role`, `CreateOrderDto.paymentId`.
- Remove any dead service methods, controller endpoints, or utility functions confirmed unused.
- Check frontend code for DTO field usage before removing fields.
- Be conservative: keep anything that might be used.

**Deliverable:** Lighter core modules with no confirmed-dead code or unused dependencies.

---

## Ticket 12 — Verification & pilot-readiness check

**Type:** Verification  
**Depends on:** Ticket 11  
**Blocks:** nothing (closeout)

- Manually verify or test each critical path:
  - Place order for open restaurant → success.
  - Place order for closed restaurant → rejected.
  - Accept order as authorized user → accepted, inventory deducted.
  - Accept order as unauthorized user → 403.
  - Reject order → rejected.
  - Verify payment → paid, payout created.
  - Cancel order within window → cancelled.
  - Auto-complete after deliverAt → completed.
  - Auto-reject after timeout → rejected.
- Run existing Jest test suite. Verify no regressions.
- Verify schema/DTO alignment: no field mismatches remain.
- Verify frontend/backend type alignment.
- Write refactor completion summary: what changed, what's coherent, what's out of scope, pilot-ready state, known remaining issues.

**Deliverable:** Verification report. System is pilot-ready.

---

## Ticket Summary

| # | Title | Type | Risk |
|---|-------|------|------|
| 0 | Read and confirm current state | Discovery | None |
| 1 | Fix OrderMenu field mismatch | Bug fix | Low |
| 2 | Fix accept/reject authorization | Security fix | Low |
| 3 | Fix removeOrder logic | Bug fix | Low |
| 4 | Add open/closed check to order creation | Bug fix + foundation | Low |
| 5 | Centralize availability logic | Refactor | Low-med |
| 6 | Align Restaurant module | Domain alignment | Low |
| 7 | Align Menu module | Domain alignment | Low-med |
| 8 | Align Order module | Domain alignment | High |
| 9 | Webhook decision & cleanup | Decision + cleanup | Low |
| 10 | Cross-cutting cleanup | Cleanup + quality | Low |
| 11 | Prototype / dead code cleanup | Cleanup | Low |
| 12 | Verification & pilot-readiness check | Verification | None (gate) |

---

*End of tickets.*
