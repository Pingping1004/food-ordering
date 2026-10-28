/**
 * Frontend mirror of backend/prisma/schema.prisma.
 *
 * Rules that follow the schema:
 *  - Money is `Int` (whole baht) everywhere – never Decimal/string.
 *  - `Order.pickupAt` replaces the old `deliverAt`.
 *  - Time-of-day is stored as minutes since midnight (`openMinute` / `closeMinute`).
 *  - Enum casing follows the schema exactly: UPPER for Role/Status/PaymentStatus/…,
 *    lower for OrderStatus/IsPaid.
 *  - Dates arrive over JSON as ISO strings.
 *
 * Keep this file in sync with schema.prisma; pages import from here only.
 */

export type ISODate = string;

/* ───────────── enums ───────────── */

export type Role = "ADMIN" | "COOKER" | "USER";
export type SchoolRole = "ADMIN" | "STAFF";
export type RestaurantRole = "OWNER" | "ADMIN" | "STAFF";
export type Status = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REMOVED";
export type MembershipStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RoleRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type PaymentStatus = "PENDING_VERIFICATION" | "UNPAID" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type OrderStatus = "receive" | "cooking" | "ready" | "done" | "delay" | "rejected";
export type IsPaid = "paid" | "unpaid" | "processing" | "rejected";
export type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export type RestaurantCategory = "Steak" | "Halal" | "Made_to_order" | "Esan" | "Rice" | "Appetizer" | "Noodle";
export type PushEventType = "new_order" | "payment_verified";

/* ───────────── models ───────────── */

export interface School {
    schoolId: string;
    name: string;
    email: string;
    profile: string | null;
    studentAmount: number;
    status: Status;
    /** Only ever present for system admins and approved admins of that school (never students / shop staff). */
    inviteCode?: string | null;
    /** Demo-day school (`npm run demo:seed`): its numbers are generated, and the UI says so. */
    isDemo?: boolean;
    createdAt: ISODate;
    updatedAt: ISODate;
}

export interface Canteen {
    canteenId: string;
    name: string;
    profile: string | null;
    status: Status;
    schoolId: string;
    createdAt: ISODate;
    updatedAt: ISODate;
}

export interface Restaurant {
    restaurantId: string;
    name: string;
    profile: string | null;
    email: string;
    location: string | null;
    categories: RestaurantCategory[];
    maxActiveOrders: number | null;
    avgCookingTimeMins: number | null;
    status: Status;
    isAutoAcceptedOrder: boolean;
    contactName: string;
    contactSurname: string | null;
    contactTel: string;
    contactEmail: string;
    bankType: string | null;
    accountNumber: string;
    accountName: string;
    paymentQr: string;
    canteenId: string;
}

export interface Menu {
    menuId: string;
    name: string;
    menuImg: string | null;
    price: number;
    maxDaily: number | null;
    cookingTimeMins: number;
    isAvailable: boolean;
    restaurantId: string;
    createdAt: ISODate;
    updatedAt: ISODate;
}

export interface OrderMenu {
    orderMenuId: string;
    quantity: number;
    menuName: string;
    menuImg: string | null;
    unitPrice: number;
    totalPrice: number;
    orderId: string;
    menuId: string;
}

export interface Order {
    orderId: string;
    status: OrderStatus;
    details: string | null;
    paymentStatus: PaymentStatus;
    totalAmount: number;
    orderAt: ISODate;
    pickupAt: ISODate;
    paidAt: ISODate | null;
    /** Set when the shop (or auto-accept) accepted the order; the student can pay only after this. */
    acceptAt?: ISODate | null;
    isDelay: boolean;
    /** Bumped on every change; student screens reload the full order when `GET /order/:id/status` reports a newer one. */
    updatedAt?: ISODate;
    restaurantId: string;
    orderMenus: OrderMenu[];
    /** Only on the cooker order-history endpoint: approved / refunded refund requests. */
    refundRequests?: { status: "APPROVED" | "REFUNDED" }[];
}

export interface OperatingHour {
    dayOfWeek: DayOfWeek;
    openMinute: number;
    closeMinute: number;
}
export type SchoolOperatingHour = OperatingHour & { id: string; schoolId: string };
export type CanteenOperatingHour = OperatingHour & { id: string; canteenId: string };
export type RestaurantOperatingHour = OperatingHour & { id: string; restaurantId: string };

export interface SchoolDateOverride {
    id: string;
    schoolId: string;
    /** yyyy-mm-dd (@db.Date) */
    date: string;
    isClosed: boolean;
    openMinute: number | null;
    closeMinute: number | null;
    reason: string | null;
}

export interface SchoolMembership {
    id: string;
    role: SchoolRole;
    status: MembershipStatus;
    userId: string;
    schoolId: string;
}

export interface RestaurantMembership {
    id: string;
    role: RestaurantRole;
    status: MembershipStatus;
    userId: string;
    restaurantId: string;
}

export interface RoleRequest {
    requestId: string;
    userId: string;
    requestRole: Role;
    status: RoleRequestStatus;
    createdAt: ISODate;
    updatedAt: ISODate;
}

/* ───────────── view models returned by the API (see INTEGRATION.md) ───────────── */

export interface SchoolListItem extends School {
    canteenCount: number;
    restaurantCount: number;
    adminName: string | null;
    /** School-admin codes (not revoked): times used / total use limit. System-admin list only. */
    adminCodeUsed?: number;
    adminCodeLimit?: number;
    /** Who created the school (system-admin list only; null for old rows). */
    applicant?: { userId: string; name: string | null; email: string } | null;
}

export interface CreateSchoolInput {
    name: string;
    email: string;
    studentAmount?: number;
    profile?: string;
}

/** `POST /admin/schools`: the new school plus its first SCHOOL_ADMIN code (the only place it is handed out in one piece). */
export interface CreatedSchool {
    school: SchoolListItem;
    adminCode: { id: string; code: string; expiresAt: string };
}

export interface MemberRow {
    id: string;
    name: string | null;
    email: string;
    role: string;
    /** PENDING → waiting for a school admin to approve. */
    status: MembershipStatus;
    pending: boolean;
}

export interface RestaurantRow extends Pick<Restaurant, "restaurantId" | "name" | "status" | "categories" | "location" | "contactName"> {
    canteenId: string;
    /**
     * Computed by the API: INACTIVE and never approved by the school. schema.prisma has no column that
     * separates "waiting for approval" from "temporarily closed" (both read INACTIVE) – see INTEGRATION.md.
     */
    pendingApproval: boolean;
    hoursLabel: string;
    createdAt: ISODate;
}

export interface KpiValue {
    value: number | null; // null → "ไม่มีข้อมูลพอ" (n < 5 suppression, plan §6.3)
    deltaLabel: string;
    good: boolean;
    direction: "up" | "down";
}

export type SummaryRange = "this_week" | "last_week" | "this_month" | "last_month" | "this_semester";

export interface SchoolSummary {
    weekLabel: string;
    weekNumber: number;
    kpis: {
        totalOrders: KpiValue;
        activeStudents: KpiValue & { percentOfEnrolled: number | null; enrolled: number | null };
        successRate: KpiValue;
        medianAcceptSeconds: KpiValue;
        rating: KpiValue & { responses: number };
        onTime: KpiValue;
        refunds: KpiValue;
    };
    ordersByDay: { label: string; count: number }[];
    reliability: { label: string; definition: string; display: string; count: number; total: number }[];
    heatmap: { slots: string[]; rows: { day: string; cells: number[]; total: number }[] };
    restaurants: { name: string; orders: number; acceptLabel: string; delayRate: number; rejected: number; revenue: number; revenueDeltaPct: number | null; status: Status | "TEMP_CLOSED" }[];
    feedback: { mean: number; responses: number; distribution: { star: number; count: number }[]; waitedLongerPct: number; comments: { rating: number; text: string; createdAt?: ISODate; restaurantName?: string | null }[] };
}

export interface DayStatus {
    isOpen: boolean;
    reason: string | null;
    date: string;
    nextOpenAt: ISODate | null;
    upcoming: { date: string; label: string; closed: boolean; hoursLabel: string | null }[];
}

export interface Workspace {
    key: string;
    kind: "student" | "restaurant" | "school" | "admin";
    name: string;
    roleLabel: string;
    href: string;
    /** A home in the demo-day school (its shops included). */
    demo?: boolean;
}

/* ───────── role-typed invite codes (docs/rbac-codes-contract.md) ───────── */

/** Codes a person can mint. The school's own student code is separate (`School.inviteCode`, rotated, never listed here). */
export type ManagedCodeType = "SHOP_OWNER" | "SCHOOL_ADMIN" | "SHOP_STAFF";
export type ManagedCodeState = "ACTIVE" | "REVOKED" | "EXPIRED" | "USED_UP";

export interface ManagedCode {
    id: string;
    /** Display form XXXX-XXXX. */
    code: string;
    type: ManagedCodeType;
    restaurantId?: string | null;
    restaurantName?: string | null;
    /** 0 = unlimited (shop staff codes). */
    maxUses: number;
    usedCount: number;
    expiresAt: string | null;
    revoked: boolean;
    state: ManagedCodeState;
    createdAt: string;
}

export interface CreateCodeInput {
    type: Exclude<ManagedCodeType, "SHOP_STAFF">;
    maxUses?: number;
    expiresInDays?: number;
}


/* ───────── refund requests + support access (docs/rbac-refund-support-contract.md) ───────── */

export type RefundRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED";
export type RefundDecisionAction = "approve" | "reject" | "mark_refunded";
export type RefundReason = "WRONG_ORDER" | "MISSING_ITEM" | "QUALITY" | "LATE_OR_NOT_READY" | "SHOP_CANCELLED" | "DUPLICATE_PAYMENT" | "OTHER";

export interface RefundItem {
    menuName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

/** `RefundRequestDto` plus what the school / student / shop endpoints add on top. */
export interface RefundRequest {
    id: string;
    orderId: string;
    reason: RefundReason | string;
    details: string | null;
    /** Whole baht (Order.totalAmount). */
    amount: number;
    status: RefundRequestStatus;
    /** The school admin's note to the student (required when rejecting). */
    decisionNote: string | null;
    decidedAt: ISODate | null;
    refundedAt: ISODate | null;
    createdAt: ISODate;
    updatedAt: ISODate;
    restaurant?: { restaurantId: string; name: string } | null;
    /** School / shop lists. */
    orderCode?: string;
    /** School endpoints: display name only, never an e-mail. */
    student?: { userId: string; name: string | null } | null;
    /** Detail endpoints. */
    order?: { orderId: string; status: OrderStatus; paymentStatus: PaymentStatus; totalAmount: number; orderAt: ISODate; pickupAt?: ISODate; paidAt?: ISODate | null; items?: RefundItem[] };
    decidedBy?: { userId: string; name: string | null } | null;
}

export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
}

export interface RefundSummary {
    counts: Record<RefundRequestStatus, number>;
    oldestPendingAt: ISODate | null;
    oldestPendingAgeMinutes: number | null;
}

/** `profile.supportGrant`: an active, audited, time-limited write grant for a system admin. */
export interface SupportGrant {
    schoolId: string;
    expiresAt: ISODate;
    reason: string;
}

/** `GET /admin/support-grants/active` row (carries the id the DELETE route needs). */
export interface ActiveSupportGrant extends SupportGrant {
    id: string;
    schoolName?: string;
    createdAt: ISODate;
}

export interface AuditEntry {
    id: string;
    createdAt: ISODate;
    actor: { userId: string | null; name: string | null; role: "SYSADMIN" | "SCHOOL_ADMIN" | "USER" };
    action: string;
    method: string | null;
    path: string | null;
    entityType: string | null;
    entityId: string | null;
    reason: string | null;
    supportGrantId: string | null;
    meta: Record<string, unknown> | null;
}
