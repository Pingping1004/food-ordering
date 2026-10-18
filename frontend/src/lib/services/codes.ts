import { api } from "@/lib/api";
import type { CreateCodeInput, ManagedCode } from "@/lib/schema";

/** Scopes that own a list of codes. The system admin uses `/admin/schools/…` (SysAdmin only); school admins `/schools/…`. */
export type CodeScope =
    | { kind: "school"; schoolId: string }
    | { kind: "admin-school"; schoolId: string }
    | { kind: "staff"; restaurantId: string };

const base = (s: CodeScope) =>
    s.kind === "school" ? `/schools/${s.schoolId}/codes`
        : s.kind === "admin-school" ? `/admin/schools/${s.schoolId}/codes`
            : `/restaurant/${s.restaurantId}/staff-codes`;

export const listCodes = async (scope: CodeScope) => (await api.get<ManagedCode[]>(base(scope))).data;

/** Staff codes take only an expiry; school codes also a type and a use limit. */
export const createCode = async (scope: CodeScope, input: { type?: CreateCodeInput["type"]; maxUses?: number; expiresInDays?: number }) => {
    const body = scope.kind === "staff" ? { expiresInDays: input.expiresInDays } : input;
    return (await api.post<ManagedCode>(base(scope), body)).data;
};

export const revokeCode = async (scope: CodeScope, codeId: string) => {
    await api.delete(`${base(scope)}/${codeId}`);
};

/** Permanently removes a code that is already used up, expired or revoked. */
export const deleteCode = async (scope: CodeScope, codeId: string) => {
    await api.delete(`${base(scope)}/${codeId}/permanent`);
};
