# PromptServe Refactor — Task Tickets

> Companion to: `docs/superpowers/specs/2026-09-12-promptserve-refactor-spec.md`
> Branch: `production`
> Status: Ready for implementation

---

## Ticket 1: Verify database state and backup

**Priority:** Critical  
**Estimate:** 30 min  
**Depends on:** nothing

**Goal:** Determine whether the Supabase database has real data before making schema changes.

**Tasks:**
1. Check if `DATABASE_URL` in `backend/.env` points to a real database with data
2. If it does: export schema and row counts for all tables as a backup reference
3. Decide: can we reset the database, or must we use incremental migrations?
4. Document the decision in this ticket's notes

**Acceptance criteria:**
- [ ] We know whether the database has real data
- [ ] If yes: we have a backup plan (either dump or documented migration path)
- [ ] If no: we can use `prisma db push --force` or `prisma migrate reset`

---

## Ticket 2: Rewrite Prisma schema — OrderStatus and PaymentStatus enums

**Priority:** Critical  
**Estimate:** 1 hour  
**Depends on:** Ticket 1 (database decision)

**Goal:** Align enums with the code's actual domain model.

**Tasks:**
1. Change `OrderStatus` enum from `receive | cooking | ready | done | delay | rejected` to `SENT | ACCEPTED | COMPLETED | CANCELLED | REJECTED`
2. Remove `delay` as a status value (it's a boolean flag, not a status)
3. Change `PaymentStatus` enum from `PENDING_VERIFICATION | UNPAID | PAID | FAILED | CANCELLED | REFUNDED` to `UNPAID | PAID | VERIFYING | FAILED`
4. Remove unused enum values (`CANCELLED`, `REFUNDED`, `PENDING_VERIFICATION`)
5. Generate Prisma client and verify it compiles

**Acceptance criteria:**
- [ ] Schema enums match the code's domain model
- [ ] `prisma generate` succeeds
- [ ] No old enum values remain in the schema

---

## Ticket 3: Fix OrderMenu and Order models

**Priority:** Critical  
**Estimate:** 1 hour  
**Depends on:** Ticket 2

**Goal:** Make Order and OrderMenu models match what the code actually creates.

**Tasks:**
1. Change `OrderMenu.unitPrice` from `Int` to `Decimal @db.Decimal(10,2)`
2. Add `maxDaily: Int` to `OrderMenu` (code sends this in create payload)
3. Remove `totalPrice` from `OrderMenu` (not used by code; total lives on Order)
4. Move `details` from `Order` to `OrderMenu` (code passes details per menu item)
5. Verify `Order.totalAmount` type matches code usage (currently `Int` in schema, code uses `Decimal` — decide which is correct)
6. Generate Prisma client and check for type errors in `OrderService.createOrder`

**Acceptance criteria:**
- [ ] `OrderMenu` has: `orderMenuId`, `quantity`, `menuName`, `menuImg`, `unitPrice` (Decimal), `maxDaily`, `orderId`, `menuId`, `menu`, `order`
- [ ] `Order` has: `details` removed if moved to OrderMenu, or kept if decided to stay on Order
- [ ] `OrderService.createOrder` compiles against the new schema

**Decision needed:** Should `details` live on `Order` or `OrderMenu`? The code passes it per-menu-item, suggesting `OrderMenu`. But `Order.details` exists in schema. Pick one and update both schema and code.

---

## Ticket 4: Add missing fields to Restaurant model

**Priority:** Critical  
**Estimate:** 1 hour  
**Depends on:** Ticket 2

**Goal:** Give Restaurant the fields that `RestaurantService` actually needs.

**Tasks:**
1. Add to `Restaurant`:
   - `openTime: String` (HH:mm format)
   - `closeTime: String` (HH:mm format)
   - `openDate: String[]` (day names like ["mon", "tue", ...])
   - `isTemporarilyClosed: Boolean @default(false)`
   - `isApproved: Boolean @default(false)`
   - `paymentQr: String`
   - `accountNumber: String`
   - `bankAccount: String`
   - `accountHolderFullName: String`
2. Decide what to do with `RestaurantOperatingHour` model:
   - Keep it for future per-day override hours (marked as future use), OR
   - Remove it if not needed for pilot
3. Keep or remove `Canteen`, `School`, `SchoolMembership`, `SchoolOperatingHour`, `SchoolDateOverride` models:
   - If not wired to the actual restaurant flow, these may be prototype artifacts
   - Decide: keep for future school infrastructure, or remove to reduce confusion
4. Generate Prisma client and verify `RestaurantService` compiles

**Acceptance criteria:**
- [ ] `Restaurant` has all fields that `RestaurantService` reads/writes
- [ ] Decision made on school/canteen models (keep or remove)
- [ ] `RestaurantService` compiles against the new schema

---

## Ticket 5: Centralize restaurant open/closed logic

**Priority:** High  
**Estimate:** 2 hours  
**Depends on:** Ticket 4

**Goal:** Create a single source of truth for "is this restaurant open right now?"

**Tasks:**
1. Add `isOpenNow(restaurantId: string): Promise<boolean>` to `RestaurantService` (or create `RestaurantOpenService`)
2. Implement the open check logic currently duplicated in `findRestaurant` and `getOpenRestaurants`:
   - Check day of week against `openDate`
   - Check current time against `openTime` / `closeTime`
   - Check `isTemporarilyClosed`
   - Handle overnight shifts (openTime > closeTime)
3. Add `canAcceptOrders(restaurantId: string): Promise<boolean>` that checks:
   - Is open now
   - Not temporarily closed
   - (Future: within active order capacity)
4. Update `OrderService.validateTimingAndQueue` to call `canAcceptOrders` before accepting an order
5. Update `getOpenRestaurants` to use the centralized method
6. Remove duplicated open/closed logic from `findRestaurant` (keep the display enrichment, delegate the check)

**Acceptance criteria:**
- [ ] `isOpenNow` works correctly for normal hours, overnight hours, closed days, temporary closure
- [ ] `canAcceptOrders` uses `isOpenNow` + temporary closed check
- [ ] `OrderService` uses `canAcceptOrders` before accepting orders
- [ ] No duplicated open/closed logic across services

---

## Ticket 6: Fix OrderService to match schema

**Priority:** Critical  
**Estimate:** 2 hours  
**Depends on:** Tickets 2, 3, 5

**Goal:** Make OrderService compile and work correctly against the corrected schema.

**Tasks:**
1. Fix `createOrder`:
   - Ensure `OrderMenu.create` payload matches schema fields exactly
   - Fix `details` placement (Order vs OrderMenu based on Ticket 3 decision)
   - Ensure `unitPrice` is passed as correct type (Decimal vs Int)
   - Ensure `maxDaily` is included if it's on OrderMenu
2. Fix `updateOrderStatus`:
   - Update transition table to use new `OrderStatus` enum values
   - Update status comparisons (`"sent"`, `"accepted"`, etc.)
   - Fix `countActiveKitchenOrders` to use new status values
3. Fix `countActiveKitchenOrders`:
   - Update `status: { in: [...] }` to use new enum values
4. Fix `updateOrderPaymentTx`:
   - Use new `PaymentStatus` enum values
   - Ensure `paymentGatewayStatus` handling is clear
5. Fix `findRestaurantTodayOrders` and `getOrdersAfterTimeStamp` if they reference changed fields
6. Run `npm run build` or `npx tsc --noEmit` to verify compilation

**Acceptance criteria:**
- [ ] `OrderService` compiles against the corrected schema
- [ ] All OrderStatus references use the new enum values
- [ ] All PaymentStatus references use the new enum values
- [ ] `createOrder` creates the right fields on Order and OrderMenu

---

## Ticket 7: Fix RestaurantService to match schema

**Priority:** High  
**Estimate:** 1.5 hours  
**Depends on:** Tickets 4, 5

**Goal:** Make RestaurantService compile and work correctly.

**Tasks:**
1. Fix `createRestaurant`:
   - Map all DTO fields to the new Restaurant schema fields
   - Ensure `openTime`/`closeTime` conversion from Date to HH:mm string works
   - Ensure all required fields are set
2. Fix `findRestaurant`:
   - Read fields that now exist on Restaurant
   - Keep `isActuallyOpen` computation but delegate to centralized method
3. Fix `findAllRestaurant`:
   - Update select to include new fields
4. Fix `updateIsTemporailyClose`:
   - Rename to `updateIsTemporarilyClose` (fix typo)
   - Ensure it updates the correct field on the new schema
5. Fix `updateIsAutoAcceptedOrder`:
   - Ensure it updates the correct field
6. Fix `removeRestaurant`:
   - Update status checks to use new enum values
7. Run compilation check

**Acceptance criteria:**
- [ ] `RestaurantService` compiles against the corrected schema
- [ ] `createRestaurant` creates a valid Restaurant with all required fields
- [ ] Typo `updateIsTemporailyClose` → `updateIsTemporarilyClose` fixed everywhere

---

## Ticket 8: Fix MenuService to match schema

**Priority:** High  
**Estimate:** 1.5 hours  
**Depends on:** Tickets 3, 4

**Goal:** Make MenuService compile and work correctly.

**Tasks:**
1. Review `MenuService` against the Menu model (Menu schema didn't have major issues, but verify)
2. Fix `getRestaurantMenusDisplay`:
   - Ensure it reads fields that exist on Menu
   - Ensure price calculation works with the final `Menu.price` type
3. Fix `createSingleMenu` and `createBulkMenus`:
   - Ensure create payload matches schema
4. Fix `updateMenu` and `mapDtoToMenuUpdate`:
   - Ensure update payload matches schema
   - Ensure `Decimal` comparison works if `price` type changed
5. Run compilation check

**Acceptance criteria:**
- [ ] `MenuService` compiles against the corrected schema
- [ ] Menu create/update flows work with correct field types

---

## Ticket 9: Fix PaymentService and webhook handling

**Priority:** High  
**Estimate:** 2 hours  
**Depends on:** Tickets 2, 6

**Goal:** Make payment flow coherent with the corrected enums and models.

**Tasks:**
1. Audit `PaymentService`:
   - Find all places that use hardcoded payment status strings
   - Replace with `PaymentStatus` enum values
2. Audit webhook handler (if it exists — check `payment.controller.ts` and any webhook routes):
   - Ensure it uses the correct enum values
   - Ensure it updates Order and creates Payout in a transaction
3. Ensure `PaymentService.verifyPayment` and `PayoutService` work together correctly:
   - One creates the payout, the other doesn't duplicate it
   - Order payment status and payout status are consistent
4. Check `payment.controller.ts`:
   - Verify endpoints use correct DTOs and status values
5. Run compilation check

**Acceptance criteria:**
- [ ] No hardcoded payment status strings in services (all use enum)
- [ ] Payment verification flow is coherent (order + payout)
- [ ] `PaymentService` compiles against corrected schema

---

## Ticket 10: Fix DTOs to match schema

**Priority:** Medium  
**Estimate:** 1.5 hours  
**Depends on:** Tickets 3, 4, 6, 7, 8, 9

**Goal:** Ensure all DTOs validate exactly what the schema and services expect.

**Tasks:**
1. Review `CreateOrderDto` and `CreateOrderMenusDto`:
   - Remove fields that don't map to schema
   - Add validation for fields that are now required
   - Ensure price validation matches backend expectations (backend looks up price from menu — DTO shouldn't trust frontend price)
2. Review `UpdateOrderDto`:
   - Align with final Order model
3. Review `CreateRestaurantDto` and `UpdateRestaurantDto`:
   - Add validation for new Restaurant fields
   - Remove fields that don't map to schema
   - Fix type mismatches (e.g., Date vs String for openTime/closeTime)
4. Review `CreateMenuDto` and `UpdateMenuDto`:
   - Align with final Menu model
5. Run compilation check on all DTOs

**Acceptance criteria:**
- [ ] Every DTO field maps to a schema field or is explicitly justified
- [ ] No DTO validates something the backend doesn't use
- [ ] All DTOs compile

---

## Ticket 11: Fix frontend type alignment

**Priority:** Medium  
**Estimate:** 2 hours  
**Depends on:** Tickets 6, 7, 8, 10

**Goal:** Ensure frontend types match the corrected backend.

**Tasks:**
1. Review frontend types in `frontend/src/lib/types/` and `frontend/src/schemas/`:
   - `Menu.ts`, `Order.ts` (if exists), DTO schemas
2. Update any status string displays that used old enum values
3. Update any DTO interfaces that changed shape
4. If `Menu.price` type changed, update frontend price display
5. Run `npm run build` on frontend to catch type errors

**Acceptance criteria:**
- [ ] Frontend builds without type errors related to schema changes
- [ ] Status displays use correct values
- [ ] DTO shapes match backend

---

## Ticket 12: End-to-end flow verification

**Priority:** High  
**Estimate:** 3 hours  
**Depends on:** Tickets 2–11

**Goal:** Verify that critical flows work end-to-end against the corrected schema.

**Tasks:**
1. **Order creation flow:**
   - Start from `CreateOrderDto` validation
   - Through `OrderService.createOrder`
   - Verify Order and OrderMenu rows are created with correct fields
   - Verify no Prisma field errors
2. **Restaurant order management flow:**
   - Accept an order → verify status transition
   - Complete an order → verify status transition
   - Reject an order → verify status transition
   - Try invalid transition → verify it's rejected
3. **Payment verification flow:**
   - Verify payment → check Order paymentStatus updated
   - Check Payout record created
   - Verify no status mismatches
4. **Restaurant open/closed flow:**
   - Create a restaurant with hours
   - Check `isOpenNow` returns correct values for open and closed times
   - Try to place order when closed → should be rejected
5. **Menu display flow:**
   - Create menus for a restaurant
   - Check `getRestaurantMenusDisplay` returns correct data

**Acceptance criteria:**
- [ ] Order creation works end-to-end
- [ ] Order status transitions work correctly
- [ ] Payment verification works end-to-end
- [ ] Restaurant open/closed logic works correctly
- [ ] Menu display works correctly

---

## Ticket 13: Cleanup prototype/dead models

**Priority:** Low  
**Estimate:** 1 hour  
**Depends on:** Tickets 4, 12

**Goal:** Remove or clearly mark models that are not wired to the application.

**Tasks:**
1. Review `School`, `Canteen`, `SchoolMembership`, `SchoolOperatingHour`, `SchoolDateOverride`, `CanteenOperatingHour`:
   - Are any of these wired to the actual restaurant/order flow?
   - If not, decide: remove now, or keep with a comment marking them as future school infrastructure?
2. Review `RoleRequest` model — is it used?
3. Remove or document any other unused models
4. Update IDEA.md section 24 if models are removed

**Acceptance criteria:**
- [ ] Every model in the schema is either used by the application or clearly marked as future work
- [ ] No confusing prototype artifacts left in the schema

---

## Ticket 14: Add basic test coverage for critical flows

**Priority:** Medium  
**Estimate:** 2 hours  
**Depends on:** Ticket 12

**Goal:** Add tests that protect the corrected flows from regression.

**Tasks:**
1. Add test for `OrderService.updateOrderStatus` transition validation
2. Add test for `RestaurantService.isOpenNow` / `canAcceptOrders`
3. Add test for `OrderService.createOrder` field mapping
4. Add test for payment status flow (if test infrastructure supports it)
5. Run tests and verify they pass

**Acceptance criteria:**
- [ ] Critical flows have at least basic test coverage
- [ ] Tests pass against the corrected schema

---

## Ticket 15: Pilot readiness review

**Priority:** High  
**Estimate:** 1 hour  
**Depends on:** All previous tickets

**Goal:** Confirm the system is ready for pilot deployment.

**Tasks:**
1. Run through the full pilot scenario mentally:
   - Restaurant registers → opens for business → receives orders → accepts → completes → gets paid
   - Student browses open restaurants → browses menus → places order → pays → picks up
2. Check all IDEA.md section 26 "Definition of Done" items
3. Document any remaining issues or known limitations
4. Get user sign-off on pilot readiness

**Acceptance criteria:**
- [ ] All spec definition-of-done items checked off
- [ ] Known limitations documented
- [ ] User confirms pilot readiness

---

## Ticket Summary

| # | Title | Priority | Estimate | Depends on |
|---|-------|----------|----------|------------|
| 1 | Verify database state and backup | Critical | 30 min | — |
| 2 | Rewrite Prisma schema — enums | Critical | 1 hr | 1 |
| 3 | Fix OrderMenu and Order models | Critical | 1 hr | 2 |
| 4 | Add missing fields to Restaurant model | Critical | 1 hr | 2 |
| 5 | Centralize restaurant open/closed logic | High | 2 hr | 4 |
| 6 | Fix OrderService to match schema | Critical | 2 hr | 2, 3, 5 |
| 7 | Fix RestaurantService to match schema | High | 1.5 hr | 4, 5 |
| 8 | Fix MenuService to match schema | High | 1.5 hr | 3, 4 |
| 9 | Fix PaymentService and webhook handling | High | 2 hr | 2, 6 |
| 10 | Fix DTOs to match schema | Medium | 1.5 hr | 3, 4, 6, 7, 8, 9 |
| 11 | Fix frontend type alignment | Medium | 2 hr | 6, 7, 8, 10 |
| 12 | End-to-end flow verification | High | 3 hr | 2–11 |
| 13 | Cleanup prototype/dead models | Low | 1 hr | 4, 12 |
| 14 | Add basic test coverage | Medium | 2 hr | 12 |
| 15 | Pilot readiness review | High | 1 hr | All |

**Total estimated effort:** ~22 hours across 15 tickets

---

## Ordering Notes

- Tickets 1–4 are a cluster: they establish the corrected schema. Do them in order.
- Ticket 5 (open/closed logic) should be done before Tickets 6 and 7, because those services will use it.
- Tickets 6, 7, 8, 9 are the main service fixes — they can be parallelized once the schema is stable.
- Ticket 10 (DTOs) depends on the final schema shape from 2–4 and service needs from 6–9.
- Ticket 11 (frontend) depends on DTOs and service changes being stable.
- Tickets 12–15 are verification and cleanup — do them last.

---

*End of tickets.*
