import { api } from "@/lib/api";
import type {
    ActiveSupportGrant, AuditEntry, Canteen, CursorPage, CreatedSchool, CreateSchoolInput, MemberRow, OperatingHour, RestaurantRow, School, SchoolDateOverride, SchoolListItem, SchoolOperatingHour, SchoolSummary, Status, SummaryRange, SupportGrant,
} from "@/lib/schema";
import { fromDayRows, summarizeHours, type DayRow } from "@/lib/schema/format";

/* ───────── schools (system admin, MFA-gated on the API) ───────── */

/** The admin list item has no counts; fill what the table shows. */
const toListItem = (s: SchoolListItem): SchoolListItem => ({
    ...s,
    canteenCount: s.canteenCount ?? 0,
    restaurantCount: s.restaurantCount ?? 0,
    adminName: s.adminName ?? s.applicant?.name ?? s.applicant?.email ?? null,
});

export const listAdminSchools = async () => (await api.get<SchoolListItem[]>("/admin/schools")).data.map(toListItem);

/** Creates an ACTIVE school and returns the first SCHOOL_ADMIN code (also listed later in the school's code manager). */
export const createSchool = async (input: CreateSchoolInput): Promise<CreatedSchool> => {
    const { data } = await api.post<CreatedSchool>("/admin/schools", input);
    return { ...data, school: toListItem(data.school) };
};

export const rotateAdminInviteCode = async (schoolId: string) =>
    (await api.post<{ inviteCode: string }>(`/admin/schools/${schoolId}/invite-code/rotate`)).data;

/** Suspend / reactivate a school. Platform action – a reason is required and audited. */
export const setSchoolStatus = async (schoolId: string, status: "ACTIVE" | "SUSPENDED", reason: string) =>
    (await api.patch<School>(`/admin/schools/${schoolId}/status`, { status, reason })).data;

/* ───────── break-glass support grant (system admin, audited + time-limited) ───────── */

export const startSupportGrant = async (schoolId: string, reason: string) =>
    (await api.post<SupportGrant & { id: string }>(`/admin/schools/${schoolId}/support-grants`, { reason })).data;

/**
 * Ends the caller's grant(s) for this school early. `DELETE …/support-grants/:id` needs the grant id, which the
 * profile does not carry, so look it up in `GET /admin/support-grants/active` first (several can be active).
 */
export const endSupportGrant = async (schoolId: string) => {
    const active = (await api.get<ActiveSupportGrant[]>("/admin/support-grants/active")).data.filter((g) => g.schoolId === schoolId);
    await Promise.all(active.map((g) => api.delete(`/admin/schools/${schoolId}/support-grants/${g.id}`)));
};

/** What platform admins did inside this school – newest first, cursor paged. */
export const listAuditLog = async (schoolId: string, params: { actor?: "sysadmin"; cursor?: string } = {}) =>
    (await api.get<CursorPage<AuditEntry>>(`/schools/${schoolId}/audit-log`, { params: { limit: 30, ...params } })).data;

/* ───────── school (scoped) ───────── */

export const getSchool = async (schoolId: string) => (await api.get<School>(`/schools/${schoolId}`)).data;

export const updateSchool = async (schoolId: string, patch: Partial<Pick<School, "name" | "email" | "studentAmount">>) =>
    (await api.patch<School>(`/schools/${schoolId}`, patch)).data;

/** School admin only – the API never sends the code to anyone else. */
export const rotateInviteCode = async (schoolId: string) =>
    (await api.post<{ inviteCode: string }>(`/schools/${schoolId}/invite-code/rotate`)).data;

export const getSchoolSummary = async (schoolId: string, range?: SummaryRange) =>
    (await api.get<SchoolSummary>(`/schools/${schoolId}/metrics/summary`, { params: range ? { range } : undefined })).data;

export const getSchoolHours = async (schoolId: string) => (await api.get<SchoolOperatingHour[]>(`/schools/${schoolId}/hours`)).data;

export const saveSchoolHours = async (schoolId: string, rows: DayRow[]) => {
    const hours: OperatingHour[] = fromDayRows(rows);
    return (await api.put<SchoolOperatingHour[]>(`/schools/${schoolId}/hours`, { hours })).data;
};

export const listOverrides = async (schoolId: string) => (await api.get<SchoolDateOverride[]>(`/schools/${schoolId}/overrides`)).data;

export type OverrideInput = Pick<SchoolDateOverride, "date" | "isClosed" | "openMinute" | "closeMinute" | "reason">;

export const addOverride = async (schoolId: string, input: OverrideInput) =>
    (await api.post<SchoolDateOverride>(`/schools/${schoolId}/overrides`, input)).data;

export const removeOverride = async (schoolId: string, id: string) => {
    await api.delete(`/schools/${schoolId}/overrides/${id}`);
};

/* ───────── members (school admins / staff – approved or waiting) ───────── */

// PENDING + APPROVED only; the API returns `status`, `pending` is derived for the tables
export const listMembers = async (schoolId: string) =>
    (await api.get<MemberRow[]>(`/schools/${schoolId}/members`)).data.filter((m) => m.status !== "REJECTED").map((m) => ({ ...m, pending: m.status === "PENDING" }));

export const approveMember = async (schoolId: string, id: string) => {
    await api.patch(`/schools/${schoolId}/members/${id}/approve`);
};

export const rejectMember = async (schoolId: string, id: string) => {
    await api.patch(`/schools/${schoolId}/members/${id}/reject`);
};

export const removeMember = async (schoolId: string, id: string) => {
    await api.delete(`/schools/${schoolId}/members/${id}`);
};

/* ───────── canteens + restaurants ───────── */

export const listCanteens = async (schoolId: string) => (await api.get<Canteen[]>(`/schools/${schoolId}/canteens`)).data;

export const createCanteen = async (schoolId: string, input: { name: string; status: Status; hours: DayRow[]; image?: File }) => {
    if (!input.image) {
        return (await api.post<Canteen>(`/schools/${schoolId}/canteens`, {
            name: input.name,
            status: input.status,
            hours: fromDayRows(input.hours),
        })).data;
    }
    const fd = new FormData();
    fd.append("name", input.name);
    fd.append("status", input.status);
    fd.append("hours", JSON.stringify(fromDayRows(input.hours)));
    fd.append("profile", input.image);
    return (await api.post<Canteen>(`/schools/${schoolId}/canteens`, fd)).data;
};

/** `pendingApproval` is derived from the new `PENDING` restaurant status (no separate column any more). */
const withPending = (r: RestaurantRow): RestaurantRow => ({
    ...r,
    // the list endpoint carries no categories / location / hours / createdAt – default them so the tables never crash
    categories: r.categories ?? [],
    location: r.location ?? null,
    hoursLabel: r.hoursLabel ?? "-",
    createdAt: r.createdAt ?? "",
    pendingApproval: r.status === "PENDING",
});

export const listRestaurants = async (schoolId: string, opts: { canteenId?: string; status?: Status } = {}) =>
    (await api.get<RestaurantRow[]>(`/schools/${schoolId}/restaurants`, { params: { status: opts.status } })).data.map(withPending);

export const setRestaurantStatus = async (schoolId: string, restaurantId: string, status: Status) => {
    await api.patch(`/schools/${schoolId}/restaurants/${restaurantId}/status`, { status });
};

export const moveRestaurantCanteen = async (schoolId: string, restaurantId: string, canteenId: string) => {
    await api.patch(`/schools/${schoolId}/restaurants/${restaurantId}/canteen`, { canteenId });
};

export const getRestaurantDetail = async (schoolId: string, restaurantId: string): Promise<RestaurantDetail> => {
    const d = (await api.get<RestaurantDetail>(`/schools/${schoolId}/restaurants/${restaurantId}`)).data;
    return { ...d, pendingApproval: d.status === "PENDING" };
};

export interface RestaurantDetail extends RestaurantRow {
    canteenName: string;
    joinedAt: string;
    contactSurname?: string | null;
    contactTel: string;
    contactEmail: string;
    maxActiveOrders: number | null;
    isAutoAcceptedOrder: boolean;
    avgCookingTimeMins: number | null;
    hours: OperatingHour[];
    people: { name: string; role: "OWNER" | "ADMIN" | "STAFF" }[];
    week: { orders: number; medianAcceptSeconds: number; delayRate: number; rejectRate: number };
}

export const hoursSummary = summarizeHours;
