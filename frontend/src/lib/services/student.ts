import { api } from "@/lib/api";
import { sendPasswordResetApi } from "@/auth/auth.service";
import { postLoginPath } from "@/auth/access";
import type { User } from "@/auth/auth.types";
import type { DayStatus, OrderStatus, PaymentStatus, Role, Workspace } from "@/lib/schema";

/* ───────── my school (joined with an invite code – the only school the caller can ever see) ───────── */

export interface MyCanteen { canteenId: string; name: string; profile?: string | null; status?: string; restaurantCount?: number }
/** `GET /me/school` – name + canteens. The invite code is never part of this payload. */
export interface MySchool { schoolId: string; name: string; canteens: MyCanteen[] }
export interface CanteenRestaurant { restaurantId: string; name: string; location?: string | null; categories?: string[]; profile?: string | null }

export const getMySchool = async () => (await api.get<MySchool>("/me/school")).data;

export const listCanteenRestaurants = async (canteenId: string) =>
    (await api.get<CanteenRestaurant[]>(`/me/school/canteens/${canteenId}/restaurants`)).data;

/** Normalise what a person typed: upper-case, no dashes / spaces. */
export const normalizeInviteCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
/** XXXX-XXXX for display while typing. */
export const formatInviteCode = (raw: string) => {
    const c = normalizeInviteCode(raw);
    return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

/** `PATCH /me/school` → 200 `{ school }` (student codes only). */
export interface JoinResult { school: { schoolId: string; name: string } }

export type RedeemType = "STUDENT" | "SHOP_OWNER" | "SHOP_STAFF" | "SCHOOL_ADMIN";
/** `POST /me/redeem-code` – the code decides the role; `status` is PENDING while an owner / school admin still has to approve. */
export interface RedeemResult {
    type: RedeemType;
    school: { schoolId: string; name: string };
    restaurant?: { restaurantId: string; name: string };
    status: "ACTIVE" | "PENDING";
}

export const redeemCode = async (code: string) =>
    (await api.post<RedeemResult>("/me/redeem-code", { code: normalizeInviteCode(code) })).data;

/** Where to go after a successful redeem. Pending staff / admins wait on their approver; owners register their shop; students pick a canteen. */
export function redeemLanding(result: RedeemResult, user: User): string {
    switch (result.type) {
        case "SHOP_OWNER": return `/cooker/restaurant-register/${user.userId}`;
        case "SHOP_STAFF":
        case "SCHOOL_ADMIN": return result.status === "PENDING" ? "/onboarding/pending" : postLoginPath(user);
        default: return "/user/onboarding/school";
    }
}

export const changeSchool = async (code: string) =>
    (await api.patch<JoinResult>("/me/school", { code: normalizeInviteCode(code) })).data;

export interface DeleteAccountResult { ok: true }

/** `DELETE /user/me` – the API answers 409 with `blockers` (owns a shop, last school admin). */
export const deleteMyAccount = async (): Promise<DeleteAccountResult> => {
    await api.delete("/user/me");
    return { ok: true };
};

interface ConflictBody { message?: string | string[]; blockers?: { code?: string; name?: string }[] }

const BLOCKER_TEXT: Record<string, (name?: string) => string> = {
    OWNS_RESTAURANT: (n) => `คุณเป็นเจ้าของร้าน${n ? ` “${n}”` : ""} ต้องลบร้านก่อน`,
    LAST_SCHOOL_ADMIN: (n) => `คุณเป็นผู้ดูแลคนสุดท้ายของโรงเรียน${n ? ` “${n}”` : ""} ต้องเพิ่มผู้ดูแลคนอื่นก่อน`,
    HAS_RESTAURANT: () => "คุณมีร้านหรือคำขอเข้าร้านอยู่ ต้องออกจากร้านก่อน",
    HAS_SCHOOL_ADMIN_ROLE: () => "คุณเป็นผู้ดูแลโรงเรียนอยู่ ต้องออกจากสิทธิ์ผู้ดูแลก่อน",
};

/** Thai sentences for the `blockers` of a 409 (`DELETE /user/me`, `PATCH /me/school`); falls back to the plain message. */
export function conflictReasons(err: unknown): string[] {
    const res = (err as { response?: { status?: number; data?: ConflictBody } })?.response;
    if (!res || res.status !== 409) return [];
    const blockers = res.data?.blockers ?? [];
    if (blockers.length) return blockers.map((b) => (BLOCKER_TEXT[b.code ?? ""]?.(b.name)) ?? b.code ?? "ไม่ทราบสาเหตุ");
    const raw = res.data?.message;
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

const SELECTION_KEY = "student-selection";
export interface StudentSelection { schoolId: string; canteenId: string; schoolName: string; canteenName: string }

export function readSelection(): StudentSelection | null {
    try {
        const raw = localStorage.getItem(SELECTION_KEY);
        return raw ? (JSON.parse(raw) as StudentSelection) : null;
    } catch {
        return null;
    }
}

export function clearSelection() {
    try {
        localStorage.removeItem(SELECTION_KEY);
    } catch {
        /* nothing to clear */
    }
}

export function saveSelection(sel: StudentSelection) {
    try {
        localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
    } catch {
        /* storage unavailable – selection is simply not remembered */
    }
}

/* ───────── "closed today" state ───────── */

export const getDayStatus = async (schoolId: string) => (await api.get<DayStatus>(`/schools/${schoolId}/today-status`)).data;

/* ───────── my orders ───────── */

export interface MyOrderRow {
    orderId: string;
    code: string;
    restaurantName: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalAmount: number;
    itemCount: number;
    itemsLabel: string;
    orderAt: string;
    pickupAt: string;
}

export const listMyOrders = async () => (await api.get<MyOrderRow[]>("/order/mine")).data;

export const isActiveOrder = (o: Pick<MyOrderRow, "status">) => o.status === "receive" || o.status === "cooking" || o.status === "ready" || o.status === "delay";

/* ───────── password reset ───────── */

export const requestPasswordReset = (email: string) => sendPasswordResetApi(email);

/* ───────── workspaces (derived from the signed-in user) ───────── */

interface UserLike {
    name?: string;
    role: string;
    school?: { schoolId: string; name: string } | null;
    restaurant?: { restaurantId: string; name?: string } | null;
    restaurantMemberships?: { role: string; status?: string; restaurantId: string; restaurantStatus?: string; restaurantName?: string; canteenName?: string; restaurantIsDemo?: boolean; restaurant?: { name: string; canteen?: { name: string } } }[];
    schoolMemberships?: { role: string; status?: string; schoolId: string; schoolName?: string; schoolIsDemo?: boolean; school?: { name: string } }[];
    userId?: string;
    pendingOwnerGrant?: boolean;
}

const isApproved = (m: { status?: string }) => (m.status ?? "APPROVED") === "APPROVED";

/** A user with >1 workspace sees the picker; exactly one → go straight in. Pending memberships are not workspaces. */
export function deriveWorkspaces(user: UserLike | null, selection: StudentSelection | null): Workspace[] {
    if (!user) return [];
    const list: Workspace[] = [];
    const school = user.school?.name ?? selection?.schoolName ?? "โรงเรียน";

    list.push({ key: "student", kind: "student", name: "สั่งอาหาร", roleLabel: `ผู้ใช้ทั่วไป · ${school}`, href: "/user/restaurant" });

    const rms = (user.restaurantMemberships ?? (user.restaurant ? [{ role: "OWNER", restaurantId: user.restaurant.restaurantId, restaurant: { name: user.restaurant.name ?? "ร้านของฉัน" } }] : [])).filter(isApproved);
    rms.forEach((m) =>
        list.push({
            key: `r-${m.restaurantId}`, kind: "restaurant", name: m.restaurantName ?? m.restaurant?.name ?? "ร้านของฉัน",
            roleLabel: `${m.role === "OWNER" ? "เจ้าของร้าน" : m.role === "ADMIN" ? "ผู้ช่วยจัดการ" : "พนักงาน"}${m.canteenName ?? m.restaurant?.canteen?.name ? ` · ${m.canteenName ?? m.restaurant?.canteen?.name}` : ""}`,
            href: (m as { restaurantStatus?: string }).restaurantStatus === "PENDING" ? `/cooker/pending/${m.restaurantId}` : `/cooker/${m.restaurantId}`,
            demo: !!m.restaurantIsDemo,
        }),
    );

    if (user.pendingOwnerGrant && !rms.length && user.userId) {
        list.push({ key: "owner-grant", kind: "restaurant", name: "ลงทะเบียนร้านของคุณ", roleLabel: "เจ้าของร้าน · ยังไม่ได้เปิดร้าน", href: `/cooker/restaurant-register/${user.userId}` });
    }

    (user.schoolMemberships ?? []).filter(isApproved).forEach((m) =>
        list.push({ key: `s-${m.schoolId}`, kind: "school", name: m.schoolName ?? m.school?.name ?? (m.schoolId === user.school?.schoolId ? user.school.name : "โรงเรียน"), roleLabel: "ผู้ดูแลโรงเรียน", href: `/school/${m.schoolId}`, demo: !!m.schoolIsDemo }),
    );

    if ((user.role as Role) === "ADMIN" || user.role === "admin") {
        list.push({ key: "admin", kind: "admin", name: "แอดมินแพลตฟอร์ม", roleLabel: "PromptServe", href: "/admin/schools" });
    }
    return list;
}
