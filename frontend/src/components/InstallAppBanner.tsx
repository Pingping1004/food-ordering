"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useAuth } from "@/auth/auth.hooks";
import { isSystemAdmin } from "@/auth/access";
import { ActionButton, Icon } from "@/components/ui/kit";
import { toastSuccess } from "@/components/ui/Toast";
import {
    detectInstallEnv,
    externalBrowserUrl,
    hasInstallPrompt,
    isRunningInstalled,
    promptInstall,
    type InstallEnv,
} from "@/lib/install-app";

const DISMISSED_KEY = "install_banner_dismissed_at";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
    try {
        const at = Number(localStorage.getItem(DISMISSED_KEY));
        return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
    } catch {
        return false;
    }
}

function snooze() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* storage blocked: shows again next visit */ }
}

/**
 * "Put Promptserve on your home screen" card, for students, cooks/shop owners and school staff on a phone (not the
 * system admin, not on a computer, not once installed). Written for people who have never installed a web app:
 * short Thai sentences, big text, one action per step, and pictures of the exact buttons to tap.
 * Android Chrome gets a one-tap install button; iPhone, other browsers and LINE get step-by-step instructions.
 * "ไว้ทีหลัง" hides it for 14 days.
 */
export function InstallAppBanner() {
    const { user } = useAuth();
    const [env, setEnv] = useState<InstallEnv | null>(null);
    const [visible, setVisible] = useState(false);
    const [canPrompt, setCanPrompt] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);

    useEffect(() => {
        const e = detectInstallEnv();
        setEnv(e);
        setVisible(e.platform !== "desktop" && !isRunningInstalled() && !snoozed());
        setCanPrompt(hasInstallPrompt());
        const onReady = () => setCanPrompt(true);
        const onInstalled = () => { setVisible(false); setCanPrompt(false); };
        window.addEventListener("installprompt-ready", onReady);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("installprompt-ready", onReady);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    if (!user || isSystemAdmin(user) || !env || !visible) return null;

    const install = async () => {
        if (canPrompt && (await promptInstall())) {
            setVisible(false);
            toastSuccess("ติดตั้งแล้ว เปิดได้จากไอคอน Promptserve บนหน้าจอ");
            return;
        }
        setCanPrompt(false);
        setGuideOpen(true);
    };
    const later = () => { snooze(); setVisible(false); };

    return (
        <>
            <section aria-label="ติดตั้งแอป Promptserve" className="no-print mx-3 mb-2 mt-3 flex flex-col gap-3 rounded-[18px] border border-primary-main/25 bg-primary-light p-4 md:hidden">
                <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 className="text-[18px] font-bold leading-snug">ติดตั้ง Promptserve ไว้บนหน้าจอมือถือ</h2>
                        <p className="text-[16px] leading-snug text-brand-dark">เปิดได้ในแตะเดียวจากไอคอน ไม่ต้องพิมพ์ชื่อเว็บทุกครั้ง และรับแจ้งเตือนได้</p>
                    </div>
                </div>
                <div className="flex gap-2.5">
                    <button type="button" onClick={later} className="h-12 flex-1 rounded-xl border-[1.5px] border-line bg-white text-[16px] font-semibold">ไว้ทีหลัง</button>
                    <button type="button" onClick={() => void install()} className="h-12 flex-[1.4] rounded-xl bg-primary-main text-[16px] font-bold text-white">
                        {canPrompt ? "ติดตั้งเลย" : "ดูวิธีติดตั้ง"}
                    </button>
                </div>
            </section>
            {guideOpen && <InstallGuide env={env} onClose={() => setGuideOpen(false)} />}
        </>
    );
}

/* ───────────────────────── step-by-step guide ───────────────────────── */

type Tab = "ios" | "android";

function InstallGuide({ env, onClose }: Readonly<{ env: InstallEnv; onClose: () => void }>) {
    const [tab, setTab] = useState<Tab>(env.platform === "ios" ? "ios" : "android");
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ground" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
            <div
                ref={panelRef}
                tabIndex={-1}
                className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto px-4 outline-none"
                style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            >
                <div className="flex items-center gap-2">
                    <h2 id="install-guide-title" className="flex-1 text-[22px] font-bold">วิธีติดตั้ง Promptserve</h2>
                    <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-white">
                        <Icon name="x" size={26} />
                    </button>
                </div>

                {env.inApp ? (
                    <InAppSteps line={env.inApp === "line"} />
                ) : (
                    <>
                        <div role="tablist" aria-label="เลือกชนิดมือถือ" className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5">
                            {(["ios", "android"] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t}
                                    onClick={() => setTab(t)}
                                    className={clsx("h-12 rounded-xl text-[17px] font-bold", tab === t ? "bg-primary-main text-white" : "text-brand-dark")}
                                >
                                    {t === "ios" ? "iPhone / iPad" : "Android"}
                                </button>
                            ))}
                        </div>
                        {tab === "ios" ? <IosSteps otherBrowser={env.platform === "ios" && env.iosBrowser === "other"} /> : <AndroidSteps samsung={env.samsung} />}
                    </>
                )}

                <p className="rounded-2xl bg-white px-4 py-3.5 text-[16px] leading-relaxed text-brand-dark">
                    <strong>หลังติดตั้ง:</strong> เปิดจากไอคอน Promptserve บนหน้าจอทุกครั้ง ครั้งแรกอาจต้องเข้าสู่ระบบใหม่อีกหนึ่งครั้ง
                </p>
                <ActionButton full onClick={onClose}>เข้าใจแล้ว</ActionButton>
            </div>
        </div>
    );
}

function Steps({ children }: Readonly<{ children: ReactNode }>) {
    return <ol className="flex flex-col gap-3">{children}</ol>;
}

function Step({ n, children, picture }: Readonly<{ n: number; children: ReactNode; picture?: ReactNode }>) {
    return (
        <li className="flex items-start gap-3.5 rounded-2xl bg-white p-4">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-main text-[20px] font-bold text-white">{n}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1 text-[18px] leading-relaxed">
                <div>{children}</div>
                {picture}
            </div>
        </li>
    );
}

/** A picture of the button to look for, drawn like the real one. */
function ButtonPicture({ icon, label }: Readonly<{ icon: ReactNode; label?: string }>) {
    return (
        <span className="inline-flex w-fit items-center gap-2.5 rounded-xl border-2 border-line bg-ground px-3.5 py-2 text-[17px] font-semibold text-brand-dark">
            <span className="text-primary-main">{icon}</span>
            {label}
        </span>
    );
}

const svg = (d: string, size = 28) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const SHARE_ICON = svg("M12 3v12M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8");
const ADD_ICON = svg("M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8v8M8 12h8");
const MORE_DOTS = (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);
const MORE_DOTS_ROW = (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
);

function IosSteps({ otherBrowser }: Readonly<{ otherBrowser: boolean }>) {
    return (
        <Steps>
            {otherBrowser && (
                <li className="rounded-2xl border-2 border-primary-main/30 bg-primary-light p-4 text-[17px] leading-relaxed">
                    ถ้าทำตามขั้นตอนแล้วไม่เจอปุ่ม ให้เปิดเว็บ <strong>promptserve.online</strong> ในแอป <strong>Safari</strong> (เข็มทิศสีฟ้า) แล้วทำใหม่
                </li>
            )}
            <Step n={1} picture={<ButtonPicture icon={SHARE_ICON} label="แชร์" />}>
                แตะปุ่ม <strong>แชร์</strong> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบด้านล่างของจอ
                <span className="mt-1 block text-[16px] text-brand-muted">ถ้าไม่เห็นแถบ ให้แตะที่ขอบล่างของจอหนึ่งครั้ง · ถ้าเห็นปุ่ม ••• ให้แตะปุ่มนั้นก่อน แล้วแตะ “แชร์” · iPad: ปุ่มอยู่มุมขวาบน</span>
            </Step>
            <Step n={2} picture={<ButtonPicture icon={ADD_ICON} label="เพิ่มไปยังหน้าจอโฮม" />}>
                เลื่อนรายการลงมา แล้วแตะ <strong>เพิ่มไปยังหน้าจอโฮม</strong>
                <span className="mt-1 block text-[16px] text-brand-muted">ถ้าไม่เจอ ให้แตะ “ดูเพิ่มเติม” หรือเลื่อนลงไปอีก</span>
            </Step>
            <Step n={3} picture={<ButtonPicture icon={svg("M20 6 9 17l-5-5")} label="เพิ่ม" />}>
                แตะ <strong>เพิ่ม</strong> ที่มุมขวาบน
            </Step>
            <Step n={4} picture={<HomeIconPicture />}>
                เสร็จแล้ว! ไอคอน <strong>Promptserve</strong> จะอยู่บนหน้าจอโฮม แตะเพื่อเปิดใช้งาน
            </Step>
        </Steps>
    );
}

function AndroidSteps({ samsung }: Readonly<{ samsung: boolean }>) {
    if (samsung)
        return (
            <Steps>
                <Step n={1} picture={<ButtonPicture icon={svg("M4 6h16M4 12h16M4 18h16")} label="เมนู" />}>
                    แตะปุ่ม <strong>เมนู</strong> (สามขีด) ที่มุมขวาล่าง
                </Step>
                <Step n={2} picture={<ButtonPicture icon={ADD_ICON} label="เพิ่มหน้าไปยัง" />}>
                    แตะ <strong>เพิ่มหน้าไปยัง</strong> แล้วเลือก <strong>หน้าจอหลัก</strong>
                </Step>
                <Step n={3} picture={<ButtonPicture icon={svg("M20 6 9 17l-5-5")} label="เพิ่ม" />}>
                    แตะ <strong>เพิ่ม</strong>
                </Step>
                <Step n={4} picture={<HomeIconPicture />}>
                    เสร็จแล้ว! ไอคอน <strong>Promptserve</strong> จะอยู่บนหน้าจอหลัก แตะเพื่อเปิดใช้งาน
                </Step>
            </Steps>
        );
    return (
        <Steps>
            <Step n={1} picture={<ButtonPicture icon={MORE_DOTS} label="เมนู" />}>
                ใน <strong>Chrome</strong> แตะปุ่ม <strong>จุดสามจุด</strong> ที่มุมขวาบนของจอ
            </Step>
            <Step n={2} picture={<ButtonPicture icon={ADD_ICON} label="ติดตั้งแอป" />}>
                แตะ <strong>ติดตั้งแอป</strong>
                <span className="mt-1 block text-[16px] text-brand-muted">บางเครื่องเขียนว่า “เพิ่มลงในหน้าจอหลัก”</span>
            </Step>
            <Step n={3} picture={<ButtonPicture icon={svg("M20 6 9 17l-5-5")} label="ติดตั้ง" />}>
                แตะ <strong>ติดตั้ง</strong> (หรือ <strong>เพิ่ม</strong>)
            </Step>
            <Step n={4} picture={<HomeIconPicture />}>
                เสร็จแล้ว! ไอคอน <strong>Promptserve</strong> จะอยู่บนหน้าจอหลัก แตะเพื่อเปิดใช้งาน
            </Step>
        </Steps>
    );
}

/** LINE / Facebook / Instagram open links in their own browser, which cannot install apps. */
function InAppSteps({ line }: Readonly<{ line: boolean }>) {
    return (
        <Steps>
            <li className="rounded-2xl border-2 border-primary-main/30 bg-primary-light p-4 text-[17px] leading-relaxed">
                ตอนนี้เปิดอยู่ใน{line ? "แอป LINE" : "แอปแชต/โซเชียล"} ซึ่งติดตั้งไม่ได้ ต้องเปิดใน <strong>Safari</strong> (iPhone) หรือ <strong>Chrome</strong> (Android) ก่อน
            </li>
            {line ? (
                <Step n={1}>
                    แตะปุ่มนี้เพื่อเปิดในเบราว์เซอร์ของมือถือ
                    <a href={externalBrowserUrl()} className="mt-3 flex h-14 items-center justify-center rounded-2xl bg-primary-main text-[18px] font-bold text-white">เปิดใน Safari / Chrome</a>
                </Step>
            ) : (
                <Step n={1} picture={<ButtonPicture icon={MORE_DOTS_ROW} label="เมนู" />}>
                    แตะปุ่ม <strong>จุดสามจุด</strong> ที่มุมบนของจอ แล้วเลือก <strong>เปิดในเบราว์เซอร์</strong> (หรือ “เปิดใน Safari / Chrome”)
                </Step>
            )}
            <Step n={2}>เมื่อเปิดในเบราว์เซอร์แล้ว จะเห็นการ์ด “ติดตั้ง Promptserve” อีกครั้ง แตะ <strong>ดูวิธีติดตั้ง</strong> แล้วทำตามขั้นตอน</Step>
        </Steps>
    );
}

function HomeIconPicture() {
    return (
        <span className="flex w-fit flex-col items-center gap-1 rounded-xl bg-ground px-4 py-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-[12px]" />
            <span className="text-[14px] font-medium">Promptserve</span>
        </span>
    );
}
