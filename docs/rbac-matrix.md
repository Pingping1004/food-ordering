# RBAC matrix

Generated from `backend/test/integration/rbac-matrix.ts` (`npx ts-node --transpile-only scripts/gen-rbac-doc.ts`).
The integration suite sends every route as every actor below against a real database: ⛔ cells must answer 401/403/404, ✅ cells must not be blocked.

✅ allowed · ⛔ refused · ◻︎ not asserted (system admin writes depend on a support grant) · · public (no login)

| Route | noSchool | student | studentOther | pendingStaff | staff | restaurantAdmin | owner | ownerOtherShop | schoolAdmin | schoolAdminOther | sysadmin | sysadminAal1 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `DELETE /admin/schools/:schoolId/codes/:codeId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `DELETE /admin/schools/:schoolId/codes/:codeId/permanent` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `DELETE /admin/schools/:schoolId/support-grants/:id` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `DELETE /menu/:menuId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /notification/device-token` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DELETE /order/:orderId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /restaurant/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /restaurant/:restaurantId/members/:memberId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /restaurant/:restaurantId/staff-codes/:codeId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /restaurant/:restaurantId/staff-codes/:codeId/permanent` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /schools/:schoolId/canteens/:canteenId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /schools/:schoolId/codes/:codeId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /schools/:schoolId/codes/:codeId/permanent` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /schools/:schoolId/members/:memberId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `DELETE /user/:userId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `DELETE /user/me` (skipped: deletes the Supabase auth user; covered separately) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET ` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /admin/complaints` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /admin/schools` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /admin/schools/:schoolId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /admin/schools/:schoolId/codes` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /admin/support-grants/active` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /health` | · | · | · | · | · | · | · | · | · | · | · | · |
| `GET /me/refund-requests` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /me/refund-requests/:id` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `GET /me/school` | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◻︎ | ◻︎ |
| `GET /me/school/canteens/:canteenId/restaurants` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /menu/:restaurantId` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /menu/find/:menuId` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /order/:orderId` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `GET /order/active-count/:restaurantId` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /order/history/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `GET /order/mine` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /order/new/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `GET /order/today/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `GET /order/trend/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `GET /payment/qr-code/:orderId` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `GET /payout` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /payout/:payoutId` (skipped: payout rows are computed, no fixture; covered by payout.service tests) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ◻︎ | ⛔ |
| `GET /payout/today` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /payout/weekly` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ⛔ |
| `GET /ready` | · | · | · | · | · | · | · | · | · | · | · | · |
| `GET /restaurant` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /restaurant/:restaurantId` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /restaurant/:restaurantId/hours` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /restaurant/:restaurantId/hours-window` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /restaurant/:restaurantId/members` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `GET /restaurant/:restaurantId/refund-requests` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /restaurant/:restaurantId/staff-codes` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/audit-log` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/canteens` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/codes` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/complaints` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/hours` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/members` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/metrics/summary` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/overrides` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/refund-requests` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/refund-requests/:id` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/refund-requests/summary` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/restaurants` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/restaurants/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /schools/:schoolId/today-status` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `GET /user` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /user/:userId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `GET /user/profile` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /admin/complaints/:id/resolve` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `PATCH /admin/schools/:schoolId/status` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `PATCH /me/school` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /menu/bulk` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /menu/is-available/:menuId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /menu/single/:menuId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /order/accept/:orderId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /order/cancel/:orderId` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `PATCH /order/delay/:orderId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /order/done/:orderId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /order/expire/:orderId` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `PATCH /order/ready/:orderId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /order/reject/:orderId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /payout/update/:payoutId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `PATCH /restaurant/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /restaurant/:restaurantId/members/:memberId/approve` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /restaurant/:restaurantId/members/:memberId/reject` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /restaurant/auto-accepted/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /restaurant/temporarily-close/:restaurantId` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId/canteens/:canteenId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId/complaints/:id/resolve` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId/members/:memberId/approve` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId/members/:memberId/reject` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId/refund-requests/:id` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId/restaurants/:restaurantId/canteen` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /schools/:schoolId/restaurants/:restaurantId/status` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PATCH /user/:userId` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `POST /admin/schools` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `POST /admin/schools/:schoolId/codes` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `POST /admin/schools/:schoolId/invite-code/rotate` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ◻︎ | ⛔ |
| `POST /admin/schools/:schoolId/support-grants` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| `POST /events` | · | · | · | · | · | · | · | · | · | · | · | · |
| `POST /me/redeem-code` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /menu/bulk` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `POST /menu/bulk-images` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `POST /menu/single` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `POST /notification/device-token` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /order/:orderId/complaint` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `POST /order/:orderId/refund-request` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `POST /order/create` | ⛔ | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `POST /payment/verify` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| `POST /restaurant` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /restaurant/:restaurantId/staff-codes` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `POST /schools/:schoolId/canteens` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `POST /schools/:schoolId/codes` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `POST /schools/:schoolId/invite-code/rotate` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `POST /upload/image` | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◻︎ | ◻︎ |
| `POST /upload/images` | ⛔ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◻︎ | ◻︎ |
| `PUT /restaurant/:restaurantId/hours` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ◻︎ | ◻︎ |
| `PUT /schools/:schoolId/hours` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |
| `PUT /schools/:schoolId/overrides` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ◻︎ | ◻︎ |

119 routes × 13 actors (anonymous is refused everywhere except the public routes).
