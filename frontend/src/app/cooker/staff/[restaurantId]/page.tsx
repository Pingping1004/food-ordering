"use client";

import { use } from "react";
import clsx from "clsx";
import { useAuth } from "@/auth/auth.hooks";
import { isSystemAdmin, restaurantRole } from "@/auth/access";
import { CodeManager } from "@/components/codes/CodeManager";
import { ActionButton, Chip, EmptyState, ErrorState, Notice, Skeleton } from "@/components/ui/kit";
import { useApproveStaff, useRejectStaff, useRemoveStaff, useStaff } from "@/hook/useCooker";
import { RESTAURANT_ROLE_LABEL } from "@/lib/schema/format";
import type { RestaurantRole } from "@/lib/schema";
import type { StaffRow } from "@/lib/services/cooker";
import { CookerShell } from "@/components/cookers/CookerShell";

const TILE: Record<RestaurantRole, string> = { OWNER: "bg-brand-orange-light text-brand-orange-text", ADMIN: "bg-primary-light text-primary-dark", STAFF: "bg-primary-light text-primary-dark" };

const initial = (p: StaffRow) => (p.name ?? p.email ?? "?").charAt(0);

/** Cooks join with a staff code the owner creates here; the owner then approves or rejects their request. */
export default function CookerStaffPage({ params }: Readonly<{ params: Promise<{ restaurantId: string }> }>) {
    const { restaurantId } = use(params);
    const { user } = useAuth();
    const staff = useStaff(restaurantId);
    // Staff codes are the owner's tool (the API also lets the platform admin through) – never rendered for cooks.
    const canMintCodes = restaurantRole(user, restaurantId) === "OWNER" || isSystemAdmin(user);
    const approve = useApproveStaff(restaurantId);
    const reject = useRejectStaff(restaurantId);
    const remove = useRemoveStaff(restaurantId);

    const rows = (staff.data ?? []).map((p) => ({ ...p, isMe: p.isMe || (!!p.userId && p.userId === user?.userId) }));
    const waiting = rows.filter((p) => p.status === "PENDING");
    const members = rows.filter((p) => p.status === "APPROVED");
    const busy = approve.isPending || reject.isPending || remove.isPending;

    const confirmRemove = (p: StaffRow) => {
        // Irreversible → ask first (design rule: destructive actions always confirm).
        if (window.confirm(`นำ ${p.name ?? "คนนี้"} ออกจากร้าน?`)) remove.mutate(p.id);
    };

    return (
        <CookerShell restaurantId={restaurantId ?? ""} active="staff">
        <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-3xl">
            <header className="flex items-center gap-2 border-b border-line-soft bg-white px-5 py-4">
                <h1 className="text-2xl font-bold">คนในร้าน</h1>
            </header>

            <main className="flex flex-1 flex-col gap-3.5 px-5 py-4">
                <Notice tone="primary" icon="info">
                    <span className="text-[15px]">สร้างรหัสพนักงานด้านล่าง ส่งให้ลูกมือสมัครบัญชีแล้วกรอกรหัส คำขอจะมาแสดงที่นี่ให้คุณอนุมัติ</span>
                </Notice>

                {canMintCodes && (
                    <CodeManager
                        scope={{ kind: "staff", restaurantId }}
                        types={["SHOP_STAFF"]}
                        title="รหัสพนักงานร้าน"
                        description="ใช้ซ้ำได้จนกว่าจะยกเลิก คนที่ใช้รหัสจะขอเข้าร้านและรอคุณอนุมัติ"
                    />
                )}

                {staff.isLoading && (
                    <ul className="flex flex-col gap-2.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3.5 rounded-[18px] border border-line-soft bg-white p-4">
                                <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-full" />
                                <div className="flex flex-1 flex-col gap-1.5">
                                    <Skeleton className="h-5 w-36 rounded-md" />
                                    <Skeleton className="h-4 w-20 rounded" />
                                </div>
                                <Skeleton className="h-10 w-20 shrink-0 rounded-xl" />
                            </li>
                        ))}
                    </ul>
                )}
                {staff.isError && <ErrorState onRetry={() => staff.refetch()} />}

                {staff.data && (
                    <section className={clsx("flex flex-col gap-2.5 rounded-[18px] border p-4", waiting.length ? "border-[#FFD2BD] bg-brand-orange-light" : "border-line-soft bg-white")} aria-labelledby="pending-title">
                        <h2 id="pending-title" className="text-xl font-bold">คำขอเข้าร้าน ({waiting.length})</h2>
                        {waiting.length === 0 && <p className="rounded-[14px] bg-white p-4 text-[15px] text-brand-muted">ยังไม่มีคำขอใหม่</p>}
                        <ul className="flex flex-col gap-2.5">
                            {waiting.map((p) => (
                                <li key={p.id} className="flex flex-col gap-3 rounded-[14px] bg-white p-4">
                                    <span className="flex items-center gap-3">
                                        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-light text-xl font-bold text-neutral-text">{initial(p)}</span>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-lg font-bold">{p.name ?? p.email}</span>
                                            <span className="text-[15px] text-brand-muted">ขอเป็นพนักงานร้าน</span>
                                        </span>
                                    </span>
                                    <div className="flex gap-2.5">
                                        <ActionButton variant="outline" size="lg" className="flex-1 !h-14" disabled={busy} onClick={() => window.confirm(`ไม่อนุมัติ ${p.name ?? "คนนี้"}?`) && reject.mutate(p.id)}>ไม่อนุมัติ</ActionButton>
                                        <ActionButton size="lg" className="flex-1 !h-14" disabled={busy} onClick={() => approve.mutate(p.id)}>อนุมัติ</ActionButton>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {staff.data && members.length === 0 && waiting.length === 0 && <EmptyState title="ยังไม่มีคนในร้าน" />}

                <ul className="flex flex-col gap-2.5">
                    {members.map((p) => (
                        <li key={p.id} className="flex items-center gap-3.5 rounded-[18px] border border-line-soft bg-white p-4">
                            <span aria-hidden="true" className={clsx("flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-xl font-bold", TILE[p.role])}>{initial(p)}</span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-[19px] font-bold">{p.name ?? p.email}{p.isMe ? " (คุณ)" : ""}</span>
                                <span className="flex"><Chip tone="success" icon="check">{RESTAURANT_ROLE_LABEL[p.role]}</Chip></span>
                            </span>
                            {!p.isMe && p.role !== "OWNER" && (
                                <button type="button" onClick={() => confirmRemove(p)} disabled={busy} className="h-12 shrink-0 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-base font-semibold hover:bg-ground">นำออก</button>
                            )}
                        </li>
                    ))}
                </ul>
            </main>
        </div>
        </CookerShell>
    );
}
