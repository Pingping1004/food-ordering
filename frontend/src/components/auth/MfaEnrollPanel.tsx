"use client";

import { ActionButton, Notice } from "@/components/ui/kit";
import { MFA_APP_NAME, MfaAppList, MfaCodeField, MfaSecret, MfaStep, MfaTroubleshoot, MfaWhereFrom } from "./MfaGuide";

export interface MfaEnrollment { factorId: string; qr: string; secret: string }

/** First-time setup: where the code comes from + 3 numbered steps + the code field. The caller owns state and the verify call. */
export function MfaEnrollPanel({ enrollment, code, onCodeChange, onSubmit, busy, error, submitLabel = "ยืนยันและเปิดใช้งาน" }: Readonly<{
    enrollment: MfaEnrollment;
    code: string;
    onCodeChange: (v: string) => void;
    onSubmit: () => void;
    busy?: boolean;
    error?: string;
    submitLabel?: string;
}>) {
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col gap-4" noValidate>
            <MfaWhereFrom />

            <ol className="m-0 flex list-none flex-col gap-4 p-0" role="list">
                <MfaStep n={1} title="ติดตั้งแอปยืนยันตัวตนบนมือถือ">
                    <p className="text-[14px] text-brand-muted">เลือกแอปใดแอปหนึ่ง (ถ้ามีอยู่แล้วข้ามได้)</p>
                    <MfaAppList />
                </MfaStep>

                <MfaStep n={2} title={`เปิดแอป กด “+” แล้วสแกน QR นี้`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={enrollment.qr} alt={`QR สำหรับเพิ่ม ${MFA_APP_NAME} ในแอปยืนยันตัวตน`} className="aspect-square w-full max-w-[220px] self-center rounded-2xl border border-line-soft bg-white p-2" />
                    <details className="group">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center text-[15px] font-semibold text-primary-dark underline focus-visible:outline-2 focus-visible:outline-primary-main">สแกนไม่ได้? ใส่รหัสลับด้วยตนเอง</summary>
                        <div className="mt-1 flex flex-col gap-2">
                            <p className="text-[14px] leading-relaxed text-brand-muted">ในแอปเลือก “ใส่รหัสลับ/คีย์ตั้งค่าด้วยตนเอง” ตั้งชื่อว่า {MFA_APP_NAME} แล้ววางรหัสนี้ (ประเภท: ตามเวลา)</p>
                            <MfaSecret secret={enrollment.secret} />
                        </div>
                    </details>
                </MfaStep>

                <MfaStep n={3} title={`ดูรหัส 6 หลักของ “${MFA_APP_NAME}” ในแอป แล้วพิมพ์ด้านล่าง`} last>
                    <MfaCodeField value={code} onChange={onCodeChange} error={error} />
                    <ActionButton type="submit" size="md" full disabled={busy}>{busy ? "กำลังตรวจสอบ..." : submitLabel}</ActionButton>
                </MfaStep>
            </ol>

            <MfaTroubleshoot />
            <Notice tone="neutral" icon="info"><span className="text-[14px]">แนะนำให้เก็บแอปนี้ไว้ในมือถือที่คุณใช้ประจำ ถ้าเปลี่ยนเครื่องจะต้องให้ผู้ดูแลรีเซ็ตให้</span></Notice>
        </form>
    );
}
