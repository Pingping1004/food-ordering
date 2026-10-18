"use client";

import { useState } from "react";
import { ActionButton, Icon, Notice, Skeleton } from "@/components/ui/kit";
import { MFA_APP_NAME, MfaCodeField, MfaLostPhone, MfaSecret, MfaTroubleshoot, MfaWhereFrom } from "./MfaGuide";
import type { MfaEnrollment } from "./MfaEnrollPanel";
import { getSupabase } from "@/lib/supabase/client";

/** Returning user: open the app, find the entry, type the current code. */
export function MfaVerifyPanel({
    code,
    onCodeChange,
    onSubmit,
    busy,
    error,
    submitLabel = "ยืนยัน",
    why,
    systemAdmin,
    onCancel,
    enrollment: initialEnrollment,
    onFactorChange,
}: Readonly<{
    code: string;
    onCodeChange: (v: string) => void;
    onSubmit: () => void;
    busy?: boolean;
    error?: string;
    submitLabel?: string;
    /** One-line “ทำไมต้องมี” shown under the instructions. */
    why?: string;
    systemAdmin?: boolean;
    onCancel?: () => void;
    enrollment?: MfaEnrollment;
    onFactorChange?: (factorId: string) => void;
}>) {
    const [showQr, setShowQr] = useState(false);
    const [loadingQr, setLoadingQr] = useState(false);
    const [enrollment, setEnrollment] = useState<MfaEnrollment | undefined>(initialEnrollment);
    const [qrError, setQrError] = useState<string>();

    const loadQr = async () => {
        setLoadingQr(true);
        setQrError(undefined);
        try {
            const mfa = getSupabase().auth.mfa;
            const { data: listData } = await mfa.listFactors();
            // Drop unverified leftovers to prevent factor name collision
            for (const f of listData?.all.filter((x) => x.factor_type === "totp" && x.status === "unverified") ?? []) {
                await mfa.unenroll({ factorId: f.id }).catch(() => undefined);
            }
            const { data, error: enrollErr } = await mfa.enroll({
                factorType: "totp",
                friendlyName: MFA_APP_NAME,
            });
            if (enrollErr) throw enrollErr;
            const newEnrollment: MfaEnrollment = {
                factorId: data.id,
                qr: data.totp.qr_code,
                secret: data.totp.secret,
            };
            setEnrollment(newEnrollment);
            onFactorChange?.(data.id);
        } catch (err: unknown) {
            console.error("Failed to load MFA enrollment QR:", err);
            setQrError("ไม่สามารถโหลดรหัส QR ได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setLoadingQr(false);
        }
    };

    const handleToggleQr = async () => {
        if (showQr) {
            setShowQr(false);
            return;
        }
        setShowQr(true);
        if (!enrollment) {
            await loadQr();
        }
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col gap-4" noValidate>
            <MfaWhereFrom />
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-6 text-[15px] leading-relaxed marker:font-bold">
                <li>เข้าไปที่แอพ <b>Google Authenticator</b> หรือ <b>Microsoft Authenticator</b> บนมือถือ</li>
                <li>
                    <div className="flex flex-wrap items-baseline gap-1.5">
                        <span>หารายการ “{MFA_APP_NAME}”</span>
                        <button
                            type="button"
                            onClick={() => void handleToggleQr()}
                            className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-primary-dark underline hover:text-primary-main focus-visible:outline-2 focus-visible:outline-primary-main"
                        >
                            <Icon name="qr" size={14} />
                            (ไม่พบรายการ {MFA_APP_NAME}?)
                        </button>
                    </div>
                </li>
                <li>พิมพ์รหัส 6 หลักที่แสดงอยู่ตอนนี้ในช่องด้านล่าง</li>
            </ol>

            {showQr && (
                <div className="flex flex-col gap-3 rounded-2xl border border-primary-light bg-ground-blue/30 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary-dark">
                                <Icon name="qr" size={18} />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-[15px] font-bold text-brand-dark">สแกน QR เพื่อเพิ่ม {MFA_APP_NAME}</span>
                                <span className="text-[13px] text-brand-muted">เพิ่มรายการในแอปยืนยันตัวตนเพื่อรับรหัส 6 หลัก</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowQr(false)}
                            aria-label="ปิดการแสดง QR Code"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-muted hover:bg-white hover:text-brand-dark"
                        >
                            <Icon name="x" size={16} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-1.5 rounded-xl border border-line-soft bg-white p-3 text-[13.5px] leading-relaxed text-slate">
                        <p className="font-semibold text-primary-dark">ขั้นตอนการเชื่อมต่อ:</p>
                        <ol className="m-0 list-decimal pl-4.5 flex flex-col gap-1">
                            <li>เปิดแอป <b>Google Authenticator</b> หรือ <b>Microsoft Authenticator</b></li>
                            <li>กดเครื่องหมาย <b>+</b> แล้วเลือก <b>สแกนรหัส QR</b></li>
                            <li>สแกนรูป QR ด้านล่างนี้ รายการ “{MFA_APP_NAME}” จะปรากฏในแอป</li>
                            <li>ดูรหัส 6 หลักที่เปลี่ยนทุก 30 วินาที แล้วนำมากรอกในช่องด้านล่าง</li>
                        </ol>
                    </div>

                    {loadingQr && (
                        <div className="flex flex-col items-center justify-center gap-2 py-6">
                            <Skeleton className="h-44 w-44 rounded-2xl" />
                            <span className="text-sm font-medium text-brand-muted animate-pulse">กำลังเตรียม QR Code...</span>
                        </div>
                    )}

                    {qrError && (
                        <div className="flex flex-col items-center gap-2 py-3 text-center">
                            <p className="text-sm font-medium text-danger-main">{qrError}</p>
                            <ActionButton size="md" variant="outline" onClick={() => void loadQr()}>ลองใหม่อีกครั้ง</ActionButton>
                        </div>
                    )}

                    {!loadingQr && !qrError && enrollment?.qr && (
                        <div className="flex flex-col items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={enrollment.qr}
                                alt={`QR สำหรับเพิ่ม ${MFA_APP_NAME} ในแอปยืนยันตัวตน`}
                                className="aspect-square w-full max-w-[200px] rounded-2xl border border-line-soft bg-white p-2.5 shadow-xs"
                            />
                            <details className="w-full text-center group">
                                <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-primary-dark underline hover:text-primary-main">
                                    สแกนไม่ได้? ใส่รหัสลับด้วยตนเอง
                                </summary>
                                <div className="mt-2 text-left">
                                    <p className="mb-1 text-[13px] text-brand-muted">
                                        ในแอปเลือก “ใส่รหัสลับ/คีย์ตั้งค่าด้วยตนเอง” ตั้งชื่อว่า {MFA_APP_NAME} แล้วใส่รหัสนี้:
                                    </p>
                                    <MfaSecret secret={enrollment.secret} />
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            )}

            <MfaCodeField value={code} onChange={onCodeChange} error={error} autoFocus />
            <div className="flex gap-2.5">
                {onCancel && <ActionButton variant="outline" size="md" className="flex-1" onClick={onCancel}>ยกเลิก</ActionButton>}
                <ActionButton type="submit" size="md" className="flex-1" disabled={busy}>{busy ? "กำลังตรวจสอบ..." : submitLabel}</ActionButton>
            </div>
            {why && <Notice tone="neutral" icon="shield"><span className="text-[14px]">{why}</span></Notice>}
            <MfaTroubleshoot />
            <MfaLostPhone systemAdmin={systemAdmin} />
        </form>
    );
}
