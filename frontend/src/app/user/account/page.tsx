"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/auth/auth.guard";
import { useAuth } from "@/auth/auth.hooks";
import { isSystemAdmin } from "@/auth/access";
import { MfaSettings } from "@/components/auth/MfaSettings";
import { StudentShell } from "@/components/users/StudentShell";
import { ActionButton, Card, Field, Icon, Notice, SwitchRow, TextInput } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import { InviteCodeForm, inviteCodeError } from "@/components/onboarding/InviteCodeForm";
import { toastError, toastDanger, toastSuccess } from "@/components/ui/Toast";
import { deactivateStoredPushToken, getNotificationPermission, requestNotificationPermission, syncCookerPushToken } from "@/lib/firebase-messaging";
import { changeSchool, clearSelection, conflictReasons, deleteMyAccount, deriveWorkspaces, readSelection, redeemCode, redeemLanding, type StudentSelection } from "@/lib/services/student";
import { getProfileApi } from "@/auth/auth.service";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TextSizeSetting } from "@/components/TextSizeSetting";

function Row({ label, value, href, onClick, last, danger }: Readonly<{ label: string; value?: string; href?: string; onClick?: () => void; last?: boolean; danger?: boolean }>) {
    const cls = `flex min-h-16 w-full items-center gap-3 text-left ${last ? "" : "border-b border-row-line"}`;
    const body = (
        <>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`text-base font-semibold ${danger ? "text-danger-text" : ""}`}>{label}</span>
                {value && <span className="truncate text-sm text-brand-muted">{value}</span>}
            </span>
            <Icon name="chevron" className="text-brand-muted" />
        </>
    );
    if (!href) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
    return <Link href={href} className={cls}>{body}</Link>;
}

function ChangeSchoolDialog({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
    const router = useRouter();
    const qc = useQueryClient();
    const { refreshUser } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    const submit = async (code: string) => {
        setBusy(true);
        setError(undefined);
        try {
            await changeSchool(code);
            clearSelection(); // the canteen belonged to the old school
            await refreshUser();
            qc.removeQueries({ queryKey: ["my-school"] });
            toastSuccess("เปลี่ยนโรงเรียนแล้ว กรุณาเลือกโรงอาหาร");
            onClose();
            router.push("/user/onboarding/school?from=account");
        } catch (err) {
            setError(inviteCodeError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title="เปลี่ยนโรงเรียน">
            <p className="text-[15px] leading-relaxed text-brand-muted">ใส่รหัสนักเรียนของโรงเรียนใหม่ เปลี่ยนไม่ได้ถ้าคุณเป็นเจ้าของร้าน พนักงานร้าน หรือผู้ดูแลโรงเรียนอยู่</p>
            <InviteCodeForm onSubmit={submit} busy={busy} error={error} label="เปลี่ยนโรงเรียน" fieldLabel="รหัสนักเรียนของโรงเรียนใหม่" hint="ขอรหัสนักเรียนจากเจ้าหน้าที่โรงเรียน เช่น ABCD-2345" />
        </Dialog>
    );
}

/** A second role for an existing account: owner / staff / school-admin codes work from here too. */
function RedeemDialog({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
    const router = useRouter();
    const qc = useQueryClient();
    const { refreshUser } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    const submit = async (code: string) => {
        setBusy(true);
        setError(undefined);
        try {
            const result = await redeemCode(code);
            const fresh = await getProfileApi();
            await refreshUser();
            qc.removeQueries({ queryKey: ["my-school"] });
            onClose();
            router.push(redeemLanding(result, fresh));
        } catch (err) {
            setError(inviteCodeError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title="ใส่รหัสเชิญ">
            <p className="text-[15px] leading-relaxed text-brand-muted">มีรหัสจากเจ้าของร้าน หรือจากผู้ดูแลโรงเรียน? ใส่ที่นี่เพื่อรับสิทธิ์เพิ่ม รหัสจะกำหนดบทบาทให้เอง</p>
            <InviteCodeForm onSubmit={submit} busy={busy} error={error} label="ใช้รหัสเชิญ" />
        </Dialog>
    );
}

const CONFIRM_WORD = "DELETE";

function DeleteAccountDialog({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
    const { logout } = useAuth();
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const [reasons, setReasons] = useState<string[]>([]);

    const close = () => { setTyped(""); setReasons([]); onClose(); };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typed !== CONFIRM_WORD) return;
        setBusy(true);
        setReasons([]);
        try {
            await deleteMyAccount();
            clearSelection();
            toastSuccess("ลบบัญชีแล้ว");
            await logout();
        } catch (err) {
            const why = conflictReasons(err);
            if (why.length) setReasons(why);
            else toastError("ลบบัญชีไม่สำเร็จ กรุณาลองใหม่", err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onClose={close} title="ลบบัญชี">
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <p className="text-[15px] leading-relaxed">การลบบัญชี<b>ย้อนกลับไม่ได้</b> ข้อมูลส่วนตัวของคุณจะถูกลบ ประวัติออเดอร์จะไม่ผูกกับชื่อคุณอีก</p>
                {reasons.length > 0 && (
                    <Notice tone="danger" icon="alert" role="alert">
                        <p className="font-semibold">ยังลบบัญชีไม่ได้เพราะ</p>
                        <ul className="mt-1 list-disc pl-5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                    </Notice>
                )}
                <Field label={`พิมพ์ ${CONFIRM_WORD} เพื่อยืนยัน`} size="lg">
                    <TextInput size="lg" value={typed} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={CONFIRM_WORD} onChange={(e) => setTyped(e.target.value)} />
                </Field>
                <div className="flex gap-2.5">
                    <ActionButton variant="outline" className="flex-1" onClick={close}>ยกเลิก</ActionButton>
                    <ActionButton type="submit" variant="danger" className="flex-1" disabled={typed !== CONFIRM_WORD || busy}>{busy ? "กำลังลบ..." : "ลบบัญชี"}</ActionButton>
                </div>
            </form>
        </Dialog>
    );
}

function Account() {
    const { user, logout } = useAuth();
    const [selection, setSelection] = useState<StudentSelection | null>(null);
    const [notify, setNotify] = useState(false);
    const [notifyBusy, setNotifyBusy] = useState(false);
    const [dialog, setDialog] = useState<"school" | "redeem" | "delete" | null>(null);

    useEffect(() => {
        setSelection(readSelection());
        setNotify(getNotificationPermission() === "granted");
    }, []);

    const workspaces = useMemo(() => deriveWorkspaces(user, selection), [user, selection]);
    // recommend (never force) 2-step for school admins and shop owners
    const recommendMfa = !!user && ((user.schoolMemberships ?? []).some((m) => m.role === "ADMIN" && (m.status ?? "APPROVED") === "APPROVED") || (user.restaurantMemberships ?? []).some((m) => m.role === "OWNER" && (m.status ?? "APPROVED") === "APPROVED"));
    const initial = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

    const toggleNotify = async (on: boolean) => {
        setNotifyBusy(true);
        try {
            if (!on) {
                await deactivateStoredPushToken();
                setNotify(false);
                toastSuccess("ปิดการแจ้งเตือนในเครื่องนี้แล้ว");
                return;
            }
            const result = await requestNotificationPermission();
            if (result !== "granted") return void toastDanger("เปิดการแจ้งเตือนไม่ได้", "การแจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ เปิดได้ที่การตั้งค่าของเว็บไซต์");
            await syncCookerPushToken();
            setNotify(true);
        } catch (err) {
            toastError("เปลี่ยนการตั้งค่าการแจ้งเตือนไม่สำเร็จ", err);
        } finally {
            setNotifyBusy(false);
        }
    };

    return (
        <StudentShell active="account">
            <header className="flex items-center gap-3.5 border-b border-line-soft bg-white px-5 py-6">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-light text-[22px] font-bold text-primary-dark" aria-hidden="true">{initial}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                    <h1 className="truncate text-[22px] font-bold">{user?.name ?? "บัญชีของฉัน"}</h1>
                    <span className="truncate text-sm text-brand-muted">{user?.email}</span>
                </span>
            </header>

            <main className="flex flex-col gap-3.5 p-4">
                <TextSizeSetting />
                <Card className="px-4 py-1">
                    <Row label="ชื่อที่แสดง" value={user?.name ?? "-"} href="/user/account#name" />
                    {/* school name only – the invite code is never shown to students */}
                    <Row label="โรงเรียน" value={user?.school?.name ?? selection?.schoolName ?? "ยังไม่ได้เข้าร่วม"} onClick={() => setDialog("school")} />
                    <Row label="โรงอาหาร" value={selection?.canteenName ?? "ยังไม่ได้เลือก"} href="/user/onboarding/school?from=account" />
                    <Row label="เปลี่ยนรหัสผ่าน" href="/forgot-password" last />
                </Card>

                <Card className="px-4 py-1">
                    <SwitchRow label="แจ้งเตือนออเดอร์" sub={notify ? "เปิดอยู่ในเครื่องนี้" : "ปิดอยู่ในเครื่องนี้"} checked={notify} onChange={toggleNotify} disabled={notifyBusy} />
                    {workspaces.length > 1 && <Row label="สลับบทบาท" value="สำหรับบัญชีที่เป็นร้านค้าหรือเจ้าหน้าที่ด้วย" href="/workspace" last />}
                </Card>

                <MfaSettings systemAdmin={isSystemAdmin(user)} recommended={recommendMfa} />

                <button type="button" onClick={() => setDialog("redeem")} className="flex items-center gap-3 rounded-[18px] bg-brand-orange-light p-4 text-left text-brand-dark">
                    <Icon name="chef" size={24} className="text-brand-orange-text" />
                    <span className="flex-1 text-[15px] font-semibold">มีรหัสเจ้าของร้าน พนักงานร้าน หรือผู้ดูแลโรงเรียน? ใส่รหัสที่นี่</span>
                    <Icon name="chevron" className="text-brand-muted" />
                </button>

                <button type="button" onClick={() => logout()} className="h-[52px] rounded-[14px] border-[1.5px] border-line bg-white text-base font-semibold text-danger-text hover:bg-ground">
                    ออกจากระบบ
                </button>

                <Card className="px-4 py-1">
                    <Row label="ลบบัญชี" value="ลบถาวร ย้อนกลับไม่ได้" onClick={() => setDialog("delete")} danger last />
                </Card>

                <ChangeSchoolDialog open={dialog === "school"} onClose={() => setDialog(null)} />
                <RedeemDialog open={dialog === "redeem"} onClose={() => setDialog(null)} />
                <DeleteAccountDialog open={dialog === "delete"} onClose={() => setDialog(null)} />
            </main>
        </StudentShell>
    );
}

export default function AccountPage() {
    return (
        <AuthGuard>
            <Account />
        </AuthGuard>
    );
}
