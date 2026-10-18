import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/lib/services/codes";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { isSysadminReadOnlyError, notifySysadminReadOnly } from "@/lib/api";

const key = (scope: svc.CodeScope) => ["codes", scope.kind, scope.kind === "staff" ? scope.restaurantId : scope.schoolId] as const;

export const useCodes = (scope: svc.CodeScope, enabled = true) =>
    useQuery({ queryKey: key(scope), queryFn: () => svc.listCodes(scope), enabled, staleTime: 30_000 });

export function useCreateCode(scope: svc.CodeScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: Parameters<typeof svc.createCode>[1]) => svc.createCode(scope, input),
        onSuccess: () => { toastSuccess("สร้างรหัสเชิญแล้ว"); qc.invalidateQueries({ queryKey: key(scope) }); },
        onError: (err) => {
            if (isSysadminReadOnlyError(err)) return notifySysadminReadOnly();
            toastError("สร้างรหัสไม่สำเร็จ กรุณาลองใหม่", err);
        },
    });
}

export function useRevokeCode(scope: svc.CodeScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (codeId: string) => svc.revokeCode(scope, codeId),
        onSuccess: () => { toastSuccess("ยกเลิกรหัสแล้ว รหัสนี้ใช้ไม่ได้อีก"); qc.invalidateQueries({ queryKey: key(scope) }); },
        onError: (err) => (isSysadminReadOnlyError(err) ? notifySysadminReadOnly() : toastError("ยกเลิกรหัสไม่สำเร็จ", err)),
    });
}

export function useDeleteCode(scope: svc.CodeScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (codeId: string) => svc.deleteCode(scope, codeId),
        onSuccess: () => { toastSuccess("ลบรหัสแล้ว"); qc.invalidateQueries({ queryKey: key(scope) }); },
        onError: (err) => (isSysadminReadOnlyError(err) ? notifySysadminReadOnly() : toastError("ลบรหัสไม่สำเร็จ", err)),
    });
}
