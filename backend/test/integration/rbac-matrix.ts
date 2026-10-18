import type { Actor } from './rbac-world';

/**
 * Expected access per route: who must get through (`allow`), and who is not asserted either way (`either`,
 * e.g. a system admin whose write access depends on a support grant). Everyone else must be refused.
 * Written from docs/rbac-api-contract.md and the scope decorators, NOT generated from the code under test.
 * A route missing from this table fails the build, so a new endpoint cannot ship without an access decision.
 */
export interface Rule {
  allow: Actor[]; either?: Actor[]; public?: boolean; skip?: string; query?: string;
  /** A VALID body (":restaurantId"-style placeholders allowed) so a missing guard shows up as a 2xx, not a validation 400/404. */
  body?: Record<string, unknown>;
  /** State of the fixture order, so the state-changing action would genuinely succeed for an authorized caller. */
  orderState?: 'received' | 'cooking' | 'ready';
}

const SYS: Actor[] = ['sysadmin'];
const IN_SCHOOL: Actor[] = ['student', 'pendingStaff', 'staff', 'restaurantAdmin', 'owner', 'ownerOtherShop', 'schoolAdmin'];
const ANY_SCHOOL: Actor[] = [...IN_SCHOOL, 'studentOther', 'schoolAdminOther'];
const AUTHED: Actor[] = [...ANY_SCHOOL, 'noSchool', 'sysadmin', 'sysadminAal1'];
const KITCHEN: Actor[] = ['owner', 'restaurantAdmin', 'staff'];
const OWNER: Actor[] = ['owner'];
const SCHOOL_ADMIN: Actor[] = ['schoolAdmin'];
const SYS_EITHER: Actor[] = ['sysadmin', 'sysadminAal1'];

const r = (allow: Actor[], extra: Partial<Rule> = {}): Rule => ({ allow, ...extra });

export const MATRIX: Record<string, Rule> = {
  // ---- public / liveness
  'GET /api/health': r([], { public: true }),
  'GET /api/ready': r([], { public: true }),
  'POST /api/events': r([], { public: true }),
  'GET /api': r(AUTHED),

  // ---- system admin only
  'DELETE /api/admin/schools/:schoolId/codes/:codeId': r(SYS),
  'DELETE /api/admin/schools/:schoolId/codes/:codeId/permanent': r(SYS),
  'DELETE /api/admin/schools/:schoolId/support-grants/:id': r(SYS),
  'GET /api/admin/complaints': r(SYS),
  'GET /api/admin/schools': r(SYS),
  'GET /api/admin/schools/:schoolId': r(SYS),
  'GET /api/admin/schools/:schoolId/codes': r(SYS),
  'GET /api/admin/support-grants/active': r(SYS),
  'PATCH /api/admin/complaints/:id/resolve': r(SYS),
  'PATCH /api/admin/schools/:schoolId/status': r(SYS, { body: { status: 'SUSPENDED', reason: 'matrix' } }),
  'POST /api/admin/schools': r(SYS),
  'POST /api/admin/schools/:schoolId/codes': r(SYS),
  // Docs list this as a sysadmin operation, but the handler lacks @SysadminWrite(), so sysadmin gets 403 SYSADMIN_READ_ONLY. Not asserted until the product owner decides.
  'POST /api/admin/schools/:schoolId/invite-code/rotate': r([], { either: SYS }),
  'POST /api/admin/schools/:schoolId/support-grants': r(SYS),
  'GET /api/payout': r(SYS),
  'GET /api/payout/today': r(SYS),
  'PATCH /api/payout/update/:payoutId': r(SYS),
  'GET /api/user': r(SYS),
  'GET /api/user/:userId': r(SYS),
  'PATCH /api/user/:userId': r(SYS, { body: { name: 'Renamed by admin' } }),
  'DELETE /api/user/:userId': r(SYS),
  'GET /api/payout/weekly': r(OWNER, { either: SYS, query: 'restaurantId=:restaurantId' }),
  'GET /api/payout/:payoutId': r([], { either: SYS, skip: 'payout rows are computed, no fixture; covered by payout.service tests' }),

  // ---- any signed-in user
  'GET /api/me/refund-requests': r(AUTHED),
  'GET /api/me/refund-requests/:id': r(['student'], { either: SYS_EITHER }),
  'GET /api/me/school': r(ANY_SCHOOL, { either: SYS_EITHER }),
  'PATCH /api/me/school': r(AUTHED),
  'POST /api/me/redeem-code': r(AUTHED),
  'GET /api/order/mine': r(AUTHED),
  'GET /api/user/profile': r(AUTHED),
  'POST /api/notification/device-token': r(AUTHED),
  'DELETE /api/notification/device-token': r(AUTHED),
  'DELETE /api/user/me': r(AUTHED, { skip: 'deletes the Supabase auth user; covered separately' }),
  'GET /api/restaurant': r(AUTHED),
  'POST /api/restaurant': r(AUTHED),

  // ---- school-scoped student surface
  'GET /api/me/school/canteens/:canteenId/restaurants': r(IN_SCHOOL, { either: SYS_EITHER }),
  'GET /api/menu/:restaurantId': r(IN_SCHOOL, { either: SYS_EITHER }),
  'GET /api/menu/find/:menuId': r(IN_SCHOOL, { either: SYS_EITHER }),
  'GET /api/order/active-count/:restaurantId': r(IN_SCHOOL, { either: SYS_EITHER }),
  'GET /api/restaurant/:restaurantId': r(IN_SCHOOL, { either: SYS_EITHER }),
  'GET /api/restaurant/:restaurantId/hours': r(IN_SCHOOL, { either: SYS_EITHER }),
  'GET /api/restaurant/:restaurantId/hours-window': r(IN_SCHOOL, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/today-status': r(IN_SCHOOL, { either: SYS_EITHER }),
  'POST /api/order/create': r(IN_SCHOOL, { either: SYS_EITHER }),
  'POST /api/upload/image': r(ANY_SCHOOL, { either: SYS_EITHER }),
  'POST /api/upload/images': r(ANY_SCHOOL, { either: SYS_EITHER }),

  // ---- order owner (student) only
  'GET /api/order/:orderId': r(['student']),
  'PATCH /api/order/cancel/:orderId': r(['student'], { orderState: 'received' }),
  'PATCH /api/order/expire/:orderId': r(['student'], { orderState: 'received' }),
  'GET /api/payment/qr-code/:orderId': r(['student']),
  'POST /api/payment/verify': r(['student']),
  'POST /api/order/:orderId/complaint': r(['student'], { body: { target: 'SCHOOL', message: 'food was cold' } }),
  'POST /api/order/:orderId/refund-request': r(['student'], { body: { reason: 'OTHER' } }),

  // ---- kitchen (owner / admin / staff of the shop)
  'GET /api/order/history/:restaurantId': r(KITCHEN, { either: SYS_EITHER }),
  'GET /api/order/new/:restaurantId': r(KITCHEN, { either: SYS_EITHER }),
  'GET /api/order/today/:restaurantId': r(KITCHEN, { either: SYS_EITHER }),
  'GET /api/order/trend/:restaurantId': r(KITCHEN, { either: SYS_EITHER }),
  'PATCH /api/order/accept/:orderId': r(KITCHEN, { either: SYS_EITHER, orderState: 'received' }),
  'PATCH /api/order/delay/:orderId': r(KITCHEN, { either: SYS_EITHER, orderState: 'cooking', body: { isDelay: true } }),
  'PATCH /api/order/done/:orderId': r(KITCHEN, { either: SYS_EITHER, orderState: 'ready' }),
  'PATCH /api/order/ready/:orderId': r(KITCHEN, { either: SYS_EITHER, orderState: 'cooking' }),
  'PATCH /api/order/reject/:orderId': r(KITCHEN, { either: SYS_EITHER, orderState: 'received' }),
  'DELETE /api/order/:orderId': r(KITCHEN, { either: SYS_EITHER, orderState: 'cooking' }),
  'GET /api/restaurant/:restaurantId/refund-requests': r([...KITCHEN, 'schoolAdmin'], { either: SYS_EITHER }),

  // ---- menu
  'POST /api/menu/single': r(KITCHEN, { either: SYS_EITHER, body: { restaurantId: ':restaurantId', name: 'Matrix dish', price: 50 } }),
  'POST /api/menu/bulk': r(KITCHEN, { either: SYS_EITHER }),
  'POST /api/menu/bulk-images': r([...KITCHEN, 'ownerOtherShop'], { either: SYS_EITHER }),
  'PATCH /api/menu/bulk': r(KITCHEN, { either: SYS_EITHER }),
  'PATCH /api/menu/single/:menuId': r(KITCHEN, { either: SYS_EITHER, body: { restaurantId: ':restaurantId', name: 'Renamed', price: '55' } }),
  'PATCH /api/menu/is-available/:menuId': r(KITCHEN, { either: SYS_EITHER, body: { restaurantId: ':restaurantId', isAvailable: false } }),
  'DELETE /api/menu/:menuId': r(['owner', 'restaurantAdmin'], { either: SYS_EITHER }),

  // ---- restaurant management
  'PATCH /api/restaurant/:restaurantId': r(OWNER, { either: SYS_EITHER, body: { name: 'Renamed shop' } }),
  'DELETE /api/restaurant/:restaurantId': r(OWNER, { either: SYS_EITHER }),
  'PUT /api/restaurant/:restaurantId/hours': r(['owner', 'restaurantAdmin'], { either: SYS_EITHER }),
  'PATCH /api/restaurant/temporarily-close/:restaurantId': r(['owner', 'staff'], { either: SYS_EITHER, body: { isTemporarilyClosed: true } }),
  'PATCH /api/restaurant/auto-accepted/:restaurantId': r(['owner', 'staff'], { either: SYS_EITHER, body: { isAutoAcceptedOrder: true } }),
  'GET /api/restaurant/:restaurantId/members': r(OWNER, { either: SYS_EITHER }),
  'PATCH /api/restaurant/:restaurantId/members/:memberId/approve': r(OWNER, { either: SYS_EITHER }),
  'PATCH /api/restaurant/:restaurantId/members/:memberId/reject': r(OWNER, { either: SYS_EITHER }),
  'DELETE /api/restaurant/:restaurantId/members/:memberId': r(OWNER, { either: SYS_EITHER }),
  'GET /api/restaurant/:restaurantId/staff-codes': r(OWNER, { either: SYS_EITHER }),
  'POST /api/restaurant/:restaurantId/staff-codes': r(OWNER, { either: SYS_EITHER }),
  'DELETE /api/restaurant/:restaurantId/staff-codes/:codeId': r(OWNER, { either: SYS_EITHER }),
  'DELETE /api/restaurant/:restaurantId/staff-codes/:codeId/permanent': r(OWNER, { either: SYS_EITHER }),

  // ---- school admin (reads: sysadmin passes; writes: sysadmin needs a support grant, so not asserted)
  'GET /api/schools/:schoolId': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/audit-log': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/canteens': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/codes': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/complaints': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/hours': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/members': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/metrics/summary': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/overrides': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/refund-requests': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/refund-requests/:id': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/refund-requests/summary': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/restaurants': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'GET /api/schools/:schoolId/restaurants/:restaurantId': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'PATCH /api/schools/:schoolId': r(SCHOOL_ADMIN, { either: SYS_EITHER, body: { profile: 'new profile' } }),
  'PATCH /api/schools/:schoolId/canteens/:canteenId': r(SCHOOL_ADMIN, { either: SYS_EITHER, body: { name: 'Renamed canteen' } }),
  'PATCH /api/schools/:schoolId/complaints/:id/resolve': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'PATCH /api/schools/:schoolId/members/:memberId/approve': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'PATCH /api/schools/:schoolId/members/:memberId/reject': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'PATCH /api/schools/:schoolId/refund-requests/:id': r(SCHOOL_ADMIN, { either: SYS_EITHER, body: { action: 'approve' } }),
  'PATCH /api/schools/:schoolId/restaurants/:restaurantId/canteen': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'PATCH /api/schools/:schoolId/restaurants/:restaurantId/status': r(SCHOOL_ADMIN, { either: SYS_EITHER, body: { status: 'SUSPENDED' } }),
  'POST /api/schools/:schoolId/canteens': r(SCHOOL_ADMIN, { either: SYS_EITHER, body: { name: 'Matrix canteen' } }),
  'POST /api/schools/:schoolId/codes': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'POST /api/schools/:schoolId/invite-code/rotate': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'PUT /api/schools/:schoolId/hours': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'PUT /api/schools/:schoolId/overrides': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'DELETE /api/schools/:schoolId/canteens/:canteenId': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'DELETE /api/schools/:schoolId/codes/:codeId': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'DELETE /api/schools/:schoolId/codes/:codeId/permanent': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
  'DELETE /api/schools/:schoolId/members/:memberId': r(SCHOOL_ADMIN, { either: SYS_EITHER }),
};
