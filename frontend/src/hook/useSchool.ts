import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/lib/services/school";
import * as me from "@/lib/services/student";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { useAuth } from "@/auth/auth.hooks";
import { isSysadminReadOnlyError, notifySysadminReadOnly } from "@/lib/api";
import type { CreateSchoolInput, Status, SummaryRange } from "@/lib/schema";
import type { DayRow } from "@/lib/schema/format";

export const key = {
    school: (id: string) => ["school", id] as const,
    summary: (id: string, range?: string) => ["school", id, "summary", range ?? "latest"] as const,
    hours: (id: string) => ["school", id, "hours"] as const,
    overrides: (id: string) => ["school", id, "overrides"] as const,
    members: (id: string) => ["school", id, "members"] as const,
    canteens: (id: string) => ["school", id, "canteens"] as const,
    restaurants: (id: string) => ["school", id, "restaurants"] as const,
    restaurant: (id: string, rid: string) => ["school", id, "restaurant", rid] as const,
    audit: (id: string) => ["school", id, "audit"] as const,
    adminSchools: (status?: string) => ["admin-schools", status ?? "all"] as const,
    mySchool: ["my-school"] as const,
    canteenRestaurants: (canteenId: string) => ["my-school", "canteen", canteenId, "restaurants"] as const,
};

const STALE = 60 * 1000;
/** Mutation `onError`: a 403 SYSADMIN_READ_ONLY opens the break-glass prompt instead of a generic failure toast. */
const fail = (msg: string) => (err?: unknown) => (isSysadminReadOnlyError(err) ? notifySysadminReadOnly() : toastError(msg, err));


export const useSchoolInfo = (schoolId: string) => useQuery({ queryKey: key.school(schoolId), queryFn: () => svc.getSchool(schoolId), staleTime: 5 * STALE });
export const useSchoolSummary = (schoolId: string, range?: SummaryRange) =>
    useQuery({ queryKey: key.summary(schoolId, range), queryFn: () => svc.getSchoolSummary(schoolId, range), staleTime: 5 * STALE });
export const useSchoolHours = (schoolId: string) => useQuery({ queryKey: key.hours(schoolId), queryFn: () => svc.getSchoolHours(schoolId), staleTime: STALE });
export const useOverrides = (schoolId: string) => useQuery({ queryKey: key.overrides(schoolId), queryFn: () => svc.listOverrides(schoolId), staleTime: STALE });
export const useMembers = (schoolId: string) => useQuery({ queryKey: key.members(schoolId), queryFn: () => svc.listMembers(schoolId), staleTime: STALE });
export const useCanteens = (schoolId: string) => useQuery({ queryKey: key.canteens(schoolId), queryFn: () => svc.listCanteens(schoolId), staleTime: STALE });
export const useSchoolRestaurants = (schoolId: string) => useQuery({ queryKey: key.restaurants(schoolId), queryFn: () => svc.listRestaurants(schoolId), staleTime: STALE });
export const useRestaurantDetail = (schoolId: string, restaurantId: string) =>
    useQuery({ queryKey: key.restaurant(schoolId, restaurantId), queryFn: () => svc.getRestaurantDetail(schoolId, restaurantId), staleTime: STALE });
export const usePendingRestaurants = (schoolId: string) =>
    useQuery({ queryKey: [...key.restaurants(schoolId), "pending"], queryFn: () => svc.listRestaurants(schoolId, { status: "PENDING" }), staleTime: STALE });

/* ───────── system admin: schools ───────── */

export const useAdminSchools = () =>
    useQuery({ queryKey: key.adminSchools(), queryFn: () => svc.listAdminSchools(), staleTime: STALE });

export function useCreateSchool() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateSchoolInput) => svc.createSchool(input),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-schools"] }); },
        // the form shows the API's 409 message (duplicate name / e-mail) itself
    });
}

export function useRotateAdminInviteCode() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => svc.rotateAdminInviteCode(id),
        onSuccess: () => { toastSuccess("สร้างรหัสเชิญใหม่แล้ว รหัสเก่าใช้ไม่ได้อีก"); qc.invalidateQueries({ queryKey: ["admin-schools"] }); },
        onError: fail("สร้างรหัสใหม่ไม่สำเร็จ"),
    });
}

/* ───────── school admin: invite code ───────── */

export function useRotateInviteCode(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => svc.rotateInviteCode(schoolId),
        onSuccess: () => { toastSuccess("สร้างรหัสเชิญใหม่แล้ว รหัสเก่าใช้ไม่ได้อีก"); qc.invalidateQueries({ queryKey: key.school(schoolId) }); },
        onError: fail("สร้างรหัสใหม่ไม่สำเร็จ"),
    });
}

/* ───────── the caller's own school (student / shop staff / onboarding) ───────── */

/** `fresh` refetches on every mount / focus, so canteens created since the last visit show up (e.g. the restaurant-register picker). */
export const useMySchool = (enabled = true, fresh = false) => useQuery({ queryKey: key.mySchool, queryFn: me.getMySchool, staleTime: fresh ? 0 : 5 * STALE, refetchOnWindowFocus: fresh, enabled, retry: false });
export const useCanteenRestaurants = (canteenId?: string) =>
    useQuery({ queryKey: key.canteenRestaurants(canteenId ?? ""), queryFn: () => me.listCanteenRestaurants(canteenId as string), enabled: !!canteenId, staleTime: STALE });

export function useSaveSchool(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (p: Parameters<typeof svc.updateSchool>[1]) => svc.updateSchool(schoolId, p),
        onSuccess: () => { toastSuccess("บันทึกข้อมูลโรงเรียนแล้ว"); qc.invalidateQueries({ queryKey: key.school(schoolId) }); },
        onError: fail("บันทึกไม่สำเร็จ"),
    });
}

export function useSaveSchoolHours(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (rows: DayRow[]) => svc.saveSchoolHours(schoolId, rows),
        onSuccess: () => { toastSuccess("บันทึกเวลาเปิดแล้ว"); qc.invalidateQueries({ queryKey: key.hours(schoolId) }); },
        onError: fail("บันทึกเวลาไม่สำเร็จ"),
    });
}

export function useAddOverride(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (i: svc.OverrideInput) => svc.addOverride(schoolId, i),
        onSuccess: () => { toastSuccess("เพิ่มวันหยุดแล้ว"); qc.invalidateQueries({ queryKey: key.overrides(schoolId) }); },
        onError: fail("เพิ่มวันหยุดไม่สำเร็จ (วันที่อาจซ้ำกับที่มีอยู่)"),
    });
}

export function useRemoveOverride(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => svc.removeOverride(schoolId, id),
        onSuccess: () => qc.invalidateQueries({ queryKey: key.overrides(schoolId) }),
        onError: fail("ลบไม่สำเร็จ"),
    });
}

export function useApproveMember(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => svc.approveMember(schoolId, id),
        onSuccess: () => { toastSuccess("อนุมัติแล้ว"); qc.invalidateQueries({ queryKey: key.members(schoolId) }); },
        onError: fail("อนุมัติไม่สำเร็จ"),
    });
}

export function useRejectMember(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => svc.rejectMember(schoolId, id),
        onSuccess: () => { toastSuccess("ไม่อนุมัติแล้ว"); qc.invalidateQueries({ queryKey: key.members(schoolId) }); },
        onError: fail("ทำรายการไม่สำเร็จ"),
    });
}

export function useRemoveMember(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => svc.removeMember(schoolId, id),
        onSuccess: () => { toastSuccess("นำออกแล้ว"); qc.invalidateQueries({ queryKey: key.members(schoolId) }); },
        onError: fail("นำออกไม่สำเร็จ (ต้องมีผู้ดูแลอย่างน้อย 1 คน)"),
    });
}

export function useCreateCanteen(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (i: Parameters<typeof svc.createCanteen>[1]) => svc.createCanteen(schoolId, i),
        onSuccess: () => { toastSuccess("สร้างโรงอาหารแล้ว"); qc.invalidateQueries({ queryKey: key.canteens(schoolId) }); },
        onError: fail("สร้างโรงอาหารไม่สำเร็จ (ชื่ออาจซ้ำในโรงเรียนนี้)"),
    });
}

export function useSetRestaurantStatus(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { restaurantId: string; status: Status; label: string }) => svc.setRestaurantStatus(schoolId, v.restaurantId, v.status),
        onSuccess: (_d, v) => { toastSuccess(v.label); qc.invalidateQueries({ queryKey: key.restaurants(schoolId) }); qc.invalidateQueries({ queryKey: ["school", schoolId, "restaurant"] }); },
        onError: fail("ทำรายการไม่สำเร็จ"),
    });
}

export function useMoveRestaurantCanteen(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { restaurantId: string; canteenId: string }) => svc.moveRestaurantCanteen(schoolId, v.restaurantId, v.canteenId),
        onSuccess: () => { toastSuccess("ย้ายโรงอาหารแล้ว"); qc.invalidateQueries({ queryKey: key.restaurants(schoolId) }); qc.invalidateQueries({ queryKey: key.canteens(schoolId) }); qc.invalidateQueries({ queryKey: ["school", schoolId, "restaurant"] }); },
        onError: fail("ย้ายโรงอาหารไม่สำเร็จ"),
    });
}

/* ───────── platform actions: suspend / reactivate ───────── */

export function useSetSchoolStatus(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { status: "ACTIVE" | "SUSPENDED"; reason: string }) => svc.setSchoolStatus(schoolId, v.status, v.reason),
        onSuccess: (_d, v) => {
            toastSuccess(v.status === "SUSPENDED" ? "ระงับโรงเรียนแล้ว" : "เปิดใช้งานโรงเรียนอีกครั้งแล้ว");
            qc.invalidateQueries({ queryKey: key.school(schoolId) });
            qc.invalidateQueries({ queryKey: ["admin-schools"] });
        },
        onError: (err) => toastError("เปลี่ยนสถานะโรงเรียนไม่สำเร็จ", err),
    });
}

/* ───────── break-glass support grant ───────── */

export function useStartSupportGrant(schoolId: string) {
    const { refreshUser } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (reason: string) => svc.startSupportGrant(schoolId, reason),
        onSuccess: async () => { await refreshUser(); await qc.invalidateQueries({ queryKey: ["school", schoolId] }); toastSuccess("เข้าโหมดช่วยเหลือแล้ว การกระทำทั้งหมดถูกบันทึก"); },
    });
}

export function useEndSupportGrant(schoolId: string) {
    const { refreshUser } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => svc.endSupportGrant(schoolId),
        onSuccess: async () => { await refreshUser(); await qc.invalidateQueries({ queryKey: ["school", schoolId] }); toastSuccess("ออกจากโหมดช่วยเหลือแล้ว"); },
        onError: (err) => toastError("ออกจากโหมดช่วยเหลือไม่สำเร็จ", err),
    });
}

/* ───────── audit log (school admins) ───────── */

export function useAuditLog(schoolId: string, sysadminOnly: boolean) {
    const actor = sysadminOnly ? ("sysadmin" as const) : undefined;
    const q = useInfiniteQuery({
        queryKey: [...key.audit(schoolId), actor ?? "all"],
        queryFn: ({ pageParam }) => svc.listAuditLog(schoolId, { actor, cursor: pageParam }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
        staleTime: STALE,
    });
    return { ...q, items: q.data?.pages.flatMap((p) => p.items) ?? [] };
}
