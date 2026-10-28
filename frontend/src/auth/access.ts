import { UserRole, type RestaurantMembershipLite, type SchoolMembershipLite, type User } from "./auth.types";

/**
 * UX-level access helpers. They only decide which screen to show – the backend guards
 * (`SystemAdmin`, `SchoolScope`, `RestaurantScope`) are what actually enforce access.
 * Memberships count only when APPROVED; payloads without a status are treated as approved.
 */

/** Enum casing differs between the new schema (UPPER) and older tokens (lower) – always compare through here. */
export const hasRole = (user: Pick<User, "role"> | null | undefined, role: UserRole | string): boolean =>
    !!user && String(user.role).toLowerCase() === String(role).toLowerCase();

export const isSystemAdmin = (user: User | null | undefined) => hasRole(user, UserRole.admin);
/** @deprecated use `isSystemAdmin` */
export const isPlatformAdmin = isSystemAdmin;

const approved = <T extends { status?: string }>(m: T) => (m.status ?? "APPROVED") === "APPROVED";
const pending = <T extends { status?: string }>(m: T) => m.status === "PENDING";

/* ───────── school ───────── */

export const schoolMemberships = (user: User | null | undefined): SchoolMembershipLite[] => user?.schoolMemberships ?? [];

/** The school the user joined with an invite code (students, shop staff, school admins alike). */
export const userSchoolId = (user: User | null | undefined): string | null => user?.school?.schoolId ?? null;
export const hasSchool = (user: User | null | undefined) => !!userSchoolId(user);

export const approvedSchoolIds = (user: User | null | undefined): string[] => schoolMemberships(user).filter(approved).map((m) => m.schoolId);
/** Kept for the workspace picker / older callers. */
export const schoolIdsOf = approvedSchoolIds;

export const isSchoolAdmin = (user: User | null | undefined, schoolId: string): boolean =>
    schoolMemberships(user).some((m) => m.schoolId === schoolId && m.role === "ADMIN" && approved(m));

/** A school-admin request (code issued by a school admin) still waiting for an existing admin's approval. */
export const pendingSchoolMembership = (user: User | null | undefined): SchoolMembershipLite | undefined =>
    schoolMemberships(user).find((m) => m.role === "ADMIN" && pending(m));

/* ───────── school write access (least privilege) ───────── */

/**
 * The school owns its operations. A system admin is READ-ONLY inside a school unless a support grant
 * (break-glass) for exactly that school is active. These helpers are the single place pages / hooks ask
 * "may this person change things here?" – the API enforces it again (403 SYSADMIN_READ_ONLY).
 */

/** The user's support grant for that school if it has not expired yet. */
export const activeSupportGrant = (user: User | null | undefined, schoolId: string, now: number = Date.now()) => {
    const g = user?.supportGrant;
    return g && g.schoolId === schoolId && new Date(g.expiresAt).getTime() > now ? g : null;
};

/** Write controls (hours, holidays, canteens, shops, members, codes, refund decisions) are enabled for this school. */
export const canWriteSchool = (user: User | null | undefined, schoolId: string, now: number = Date.now()): boolean =>
    !!user && (isSchoolAdmin(user, schoolId) || (isSystemAdmin(user) && !!activeSupportGrant(user, schoolId, now)));

/** A system admin looking at a school they do not administer, without an active grant. */
export const isSysadminReadOnly = (user: User | null | undefined, schoolId: string, now: number = Date.now()): boolean =>
    isSystemAdmin(user) && !isSchoolAdmin(user, schoolId) && !activeSupportGrant(user, schoolId, now);

/** Break-glass can be started by a system admin who is not already an admin of that school. */
export const canStartSupportGrant = (user: User | null | undefined, schoolId: string): boolean =>
    isSystemAdmin(user) && !isSchoolAdmin(user, schoolId);

/** Why write controls are disabled – shown as tooltip / aria text. */
export const READ_ONLY_REASON = "โหมดอ่านอย่างเดียว: ผู้ดูแลระบบแก้ไขข้อมูลของโรงเรียนไม่ได้ ต้องเข้าโหมดช่วยเหลือ (Break-glass) ก่อน";
export const STAFF_READ_ONLY_REASON = "เจ้าหน้าที่ดูข้อมูลได้อย่างเดียว ต้องเป็นผู้ดูแลโรงเรียนจึงจะแก้ไขได้";

/* ───────── restaurants ───────── */

export const restaurantMemberships = (user: User | null | undefined): RestaurantMembershipLite[] => user?.restaurantMemberships ?? [];

export const restaurantIdsOf = (user: User | null | undefined): string[] => {
    if (!user) return [];
    const ids = new Set(restaurantMemberships(user).filter(approved).map((m) => m.restaurantId));
    if (user.restaurant?.restaurantId) ids.add(user.restaurant.restaurantId);
    return [...ids];
};

/** Role of the caller in that shop, `null` when not an approved member. */
export const restaurantRole = (user: User | null | undefined, restaurantId: string): RestaurantMembershipLite["role"] | null =>
    restaurantMemberships(user).find((m) => m.restaurantId === restaurantId && approved(m))?.role ?? null;

/** A cook who asked to join a shop and is waiting for the owner. */
export const pendingStaffMembership = (user: User | null | undefined): RestaurantMembershipLite | undefined =>
    restaurantMemberships(user).find((m) => m.role === "STAFF" && pending(m));

/** Restaurant area: any approved restaurant membership, or the system admin. */
export const canUseCooker = (user: User | null | undefined) =>
    !!user && (hasRole(user, UserRole.cooker) || restaurantIdsOf(user).length > 0 || isSystemAdmin(user));

/** School dashboard: approved member of that school, or the system admin (support access). */
export const canUseSchool = (user: User | null | undefined, schoolId: string) =>
    !!user && (approvedSchoolIds(user).includes(schoolId) || isSystemAdmin(user));

/* ───────── demo data (School.isDemo, `npm run demo:seed`) ───────── */

export type DataHome = { kind: "school" | "restaurant"; id: string; href: string; demo: boolean };

/** Every approved school / shop home of the user, tagged real or demo – the data switch moves between the two sets. */
export function dataHomes(user: User | null | undefined): DataHome[] {
    const schools = schoolMemberships(user).filter(approved).map((m): DataHome => ({ kind: "school", id: m.schoolId, href: `/school/${m.schoolId}`, demo: !!m.schoolIsDemo }));
    const shops = restaurantMemberships(user)
        .filter((m) => approved(m) && (m.restaurantStatus ?? m.restaurant?.status) !== "PENDING")
        .map((m): DataHome => ({ kind: "restaurant", id: m.restaurantId, href: `/cooker/${m.restaurantId}`, demo: !!m.restaurantIsDemo }));
    return [...schools, ...shops];
}

/* ───────── routing ───────── */

/** Home of every non-student role the user holds (approved only). Students have no entry – "/user/restaurant" is their home. */
export function roleHomes(user: User | null | undefined): string[] {
    if (!user) return [];
    const homes: string[] = [];
    if (isSystemAdmin(user)) homes.push("/admin/schools");
    approvedSchoolIds(user).forEach((id) => homes.push(`/school/${id}`));

    const shops = restaurantMemberships(user).filter(approved);
    shops.forEach((m) => homes.push((m.restaurantStatus ?? m.restaurant?.status) === "PENDING" && m.role === "OWNER" ? `/cooker/pending/${m.restaurantId}` : `/cooker/${m.restaurantId}`));
    if (!shops.length && user.restaurant?.restaurantId) homes.push(`/cooker/${user.restaurant.restaurantId}`);

    // Owner code redeemed, shop not registered yet.
    if (user.pendingOwnerGrant && !homes.some((h) => h.startsWith("/cooker/"))) homes.push(`/cooker/restaurant-register/${user.userId}`);
    return [...new Set(homes)];
}

/** Where "my home" is when the user holds a role besides student: its page, or the picker for several. `null` = plain student. */
export function roleHomePath(user: User | null | undefined): string | null {
    const homes = roleHomes(user);
    if (!homes.length) return null;
    return homes.length === 1 ? homes[0] : "/workspace";
}

/** Where to land after sign-in. The role decides – ordering ("/user/restaurant") is only the default for students. */
export function postLoginPath(user: User): string {
    const home = roleHomePath(user);
    if (home) return home;

    // Nothing approved yet: a request waiting on someone else, or no school at all.
    if (pendingSchoolMembership(user) || pendingStaffMembership(user)) return "/onboarding/pending";
    if (!hasSchool(user)) return "/onboarding";
    return "/user/restaurant";
}

/** True while the user is waiting on someone else's approval and has nothing else to do yet. */
export const awaitingApproval = (user: User | null | undefined): boolean => !!user && postLoginPath(user) === "/onboarding/pending";

export function userHomePath(user: User | null | undefined, fromSchoolId?: string): string {
    if (!user) return "/user/restaurant";

    // 1. System / Platform Admin -> /admin/schools
    if (isSystemAdmin(user) || hasRole(user, UserRole.admin)) {
        return "/admin/schools";
    }

    // 2. Cooker -> /cooker/[restaurantId]
    if (hasRole(user, UserRole.cooker)) {
        const shops = restaurantMemberships(user).filter(approved);
        const shop = shops[0];
        if (shop) {
            return (shop.restaurantStatus ?? shop.restaurant?.status) === "PENDING" && shop.role === "OWNER"
                ? `/cooker/pending/${shop.restaurantId}`
                : `/cooker/${shop.restaurantId}`;
        }
        if (user.restaurant?.restaurantId) return `/cooker/${user.restaurant.restaurantId}`;
        return "/cooker";
    }

    // 3. From inside a school dashboard:
    if (fromSchoolId) {
        const homes = roleHomes(user);
        // If holding multiple non-student roles or workspaces, go to /workspace
        if (homes.length > 1) {
            return "/workspace";
        }
        return "/user/restaurant";
    }

    const home = roleHomePath(user);
    if (home) return home;

    return "/user/restaurant";
}
