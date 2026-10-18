"use client";

import { useState } from "react";
import clsx from "clsx";
import { ActionButton, Field, Icon, Notice, TextInput } from "@/components/ui/kit";

/** Name shown for our entry inside the authenticator app (passed to Supabase as `friendlyName`). */
export const MFA_APP_NAME = "PromptServe";

/** Shared copy + small pieces for the TOTP guide. Used by the enrol panel, the verify panel and the account page. */

/** The one sentence everybody must understand: where the 6 digits come from. */
export function MfaWhereFrom({ className }: Readonly<{ className?: string }>) {
    return (
        <Notice tone="primary" icon="info" className={className}>
            <p className="font-semibold">รหัส 6 หลักมาจากแอปยืนยันตัวตนบนมือถือของคุณ</p>
            <p className="mt-0.5 text-[14px] leading-relaxed">ไม่ได้ส่งทางอีเมลหรือ SMS และเปลี่ยนใหม่ทุก 30 วินาที</p>
        </Notice>
    );
}

const APPS: { name: string; ios: string; android: string }[] = [
    { name: "Google Authenticator", ios: "https://apps.apple.com/app/google-authenticator/id388497605", android: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" },
    { name: "Microsoft Authenticator", ios: "https://apps.apple.com/app/microsoft-authenticator/id983156458", android: "https://play.google.com/store/apps/details?id=com.azure.authenticator" },
    { name: "Authy", ios: "https://apps.apple.com/app/authy/id494168017", android: "https://play.google.com/store/apps/details?id=com.authy.authy" },
    { name: "1Password", ios: "https://apps.apple.com/app/1password-password-manager/id1511601750", android: "https://play.google.com/store/apps/details?id=com.onepassword.android" },
];

const STORE_LINK = "inline-flex min-h-11 items-center rounded-lg border-[1.5px] border-line bg-white px-3 text-[14px] font-semibold text-primary-dark hover:bg-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-main";

/** Step 1 body – pick an app and open its store page. */
export function MfaAppList() {
    return (
        <ul className="mt-2 flex flex-col gap-2">
            {APPS.map((a) => (
                <li key={a.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-[10.5rem] flex-1 text-[15px] font-semibold">{a.name}</span>
                    <span className="flex gap-2">
                        <a href={a.ios} target="_blank" rel="noopener noreferrer" className={STORE_LINK} aria-label={`${a.name} บน App Store (เปิดแท็บใหม่)`}>App Store</a>
                        <a href={a.android} target="_blank" rel="noopener noreferrer" className={STORE_LINK} aria-label={`${a.name} บน Google Play (เปิดแท็บใหม่)`}>Google Play</a>
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** Numbered step. Wrap several in an <ol>. */
export function MfaStep({ n, title, children, last }: Readonly<{ n: number; title: string; children?: React.ReactNode; last?: boolean }>) {
    return (
        <li className={clsx("flex gap-3", !last && "border-b border-row-line pb-4")}>
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-[15px] font-bold text-primary-dark">{n}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <h3 className="text-base font-bold leading-snug">{title}</h3>
                {children}
            </div>
        </li>
    );
}

/** Secret key for manual entry, with a copy button (clipboard may be blocked → the key stays selectable). */
export function MfaSecret({ secret }: Readonly<{ secret: string }>) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            setCopied(false);
        }
    };
    return (
        <div className="flex flex-col gap-2 rounded-2xl bg-ground p-3">
            <code className="break-all select-all font-mono text-[15px] font-bold tracking-wider" aria-label="รหัสลับสำหรับใส่ด้วยตนเอง">{secret}</code>
            <div className="flex items-center gap-3">
                <ActionButton variant="outline" size="md" onClick={() => void copy()}>
                    <Icon name="file" size={16} />คัดลอกรหัสลับ
                </ActionButton>
                <span role="status" aria-live="polite" className="text-sm font-semibold text-success-main">{copied ? "คัดลอกแล้ว" : ""}</span>
            </div>
        </div>
    );
}

/** The 6-digit field: numeric keypad, OTP autofill, aria-live error. */
export function MfaCodeField({ value, onChange, error, label = "รหัส 6 หลักจากแอป", autoFocus }: Readonly<{ value: string; onChange: (v: string) => void; error?: string; label?: string; autoFocus?: boolean }>) {
    return (
        <Field label={label} error={error} hint={error ? undefined : "พิมพ์ตัวเลข 6 ตัวที่เห็นในแอป ไม่ต้องเว้นวรรค"}>
            <TextInput
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus={autoFocus}
                value={value}
                invalid={!!error}
                placeholder="123456"
                className="!h-[52px] text-center font-mono text-[22px] tracking-[0.4em]"
                onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
        </Field>
    );
}

export const MFA_CODE_ERROR_FORMAT = "กรุณาใส่รหัส 6 หลักจากแอปยืนยันตัวตน";
export const MFA_CODE_ERROR_WRONG = "รหัสไม่ถูกต้องหรือหมดอายุ ลองรหัสถัดไปที่แอปแสดง";

export function MfaTroubleshoot() {
    return (
        <details className="group rounded-2xl border border-line-soft px-4 py-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-primary-main">
                รหัสใช้ไม่ได้?
                <Icon name="chevronDown" className="text-brand-muted transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mb-3 list-disc pl-5 text-[14px] leading-relaxed text-brand-muted">
                <li>ตั้งเวลาในมือถือเป็น “อัตโนมัติ” (ตั้งค่า &gt; วันที่และเวลา) ถ้านาฬิกาเพี้ยน รหัสจะไม่ตรง</li>
                <li>รหัสหมดอายุเร็ว (30 วินาที) ถ้าไม่ทัน ให้รอรหัสถัดไปแล้วพิมพ์ใหม่</li>
                <li>ใส่ผิดหลายครั้งติดกัน ระบบอาจให้รอสักครู่ก่อนลองใหม่</li>
            </ul>
        </details>
    );
}

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "piyatanakj@gmail.com";
const SUPPORT_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent("ขอรีเซ็ตการยืนยันตัวตน (MFA)")}`;

/** “Why do we need this” + “lost phone” – shown on the verify screen. */
export function MfaLostPhone({ systemAdmin }: Readonly<{ systemAdmin?: boolean }>) {
    return (
        <details className="group rounded-2xl border border-line-soft px-4 py-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-primary-main">
                ทำเครื่องหาย หรือเปลี่ยนมือถือ?
                <Icon name="chevronDown" className="text-brand-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="mb-3 text-[14px] leading-relaxed text-brand-muted">
                {systemAdmin
                    ? "ต้องรีเซ็ตการยืนยันตัวตนผ่านขั้นตอนกู้คืนโดยผู้ดูแลฐานข้อมูลของแพลตฟอร์ม"
                    : "ติดต่อผู้ดูแลแพลตฟอร์มเพื่อรีเซ็ตการยืนยันตัวตนของบัญชีคุณ แล้วตั้งค่าใหม่บนมือถือเครื่องใหม่"}
            </p>
            <a href={SUPPORT_COMPOSE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-main underline">ติดต่อเจ้าหน้าที่</a>
        </details>
    );
}
