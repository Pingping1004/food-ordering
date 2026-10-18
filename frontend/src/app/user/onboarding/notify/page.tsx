"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CenteredScreen } from "@/components/users/StudentShell";
import { ActionButton, Icon, type IconName } from "@/components/ui/kit";
import { toastError, toastDanger, toastSuccess } from "@/components/ui/Toast";
import { getNotificationPermission, requestNotificationPermission, syncCookerPushToken } from "@/lib/firebase-messaging";
import { isIOS } from "@/lib/device";

const SHOP_EVENTS: { text: string; icon: IconName; tile: string }[] = [
    { text: "มีออเดอร์ใหม่เข้าร้าน", icon: "bell", tile: "bg-primary-light text-primary-dark" },
    { text: "ลูกค้าโอนเงินแล้ว ตรวจสลิปผ่าน", icon: "check", tile: "bg-success-light text-success-main" },
];

const EVENTS: { text: string; icon: IconName; tile: string }[] = [
    { text: "ร้านรับออเดอร์แล้ว ชำระเงินได้", icon: "bell", tile: "bg-primary-light text-primary-dark" },
    { text: "ร้านแจ้งว่าช้า", icon: "clock", tile: "bg-brand-orange-light text-brand-orange-text" },
    { text: "อาหารพร้อมรับ", icon: "check", tile: "bg-success-light text-success-main" },
];

export default function NotifyPage() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [ios, setIos] = useState(false);
    const [permission, setPermission] = useState<ReturnType<typeof getNotificationPermission>>("default");
    // Same-origin path to return to (the cooker "waiting for approval" page passes this); students land on ordering.
    const [next, setNext] = useState("/user/restaurant");
    const [forShop, setForShop] = useState(false);

    useEffect(() => {
        const target = new URLSearchParams(window.location.search).get("next");
        if (target?.startsWith("/cooker/") && !target.startsWith("//")) { setNext(target); setForShop(true); }
        else if (target?.startsWith("/user/") && !target.startsWith("//")) setNext(target);
        setIos(isIOS());
        setPermission(getNotificationPermission());
    }, []);

    const enable = async () => {
        setBusy(true);
        try {
            const result = await requestNotificationPermission();
            setPermission(result);
            if (result !== "granted") {
                toastDanger("เปิดการแจ้งเตือนไม่ได้", result === "denied" ? "การแจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ เปิดได้ที่การตั้งค่าของเว็บไซต์" : "เบราว์เซอร์ที่ใช้อยู่ไม่รองรับการแจ้งเตือน");
                return;
            }
            const sync = await syncCookerPushToken();
            if (sync.status === "registered") toastSuccess("เปิดการแจ้งเตือนแล้ว");
            router.push(next);
        } catch (err) {
            toastError("เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่ภายหลังได้ที่หน้าบัญชี", err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <CenteredScreen tone="blue">
            <div className="mt-4 flex h-28 w-28 items-center justify-center self-center rounded-[32px] bg-primary-main text-white">
                <Icon name="bell" size={56} strokeWidth={1.8} />
            </div>

            <div className="flex flex-col gap-2.5 text-center">
                <h1 className="text-[28px] font-bold leading-tight">{forShop ? "รู้ทันทีเมื่อมีออเดอร์" : "รับแจ้งเตือนเมื่อร้านรับออเดอร์ อาหารพร้อม หรือร้านทำช้า"}</h1>
                <p className="text-base leading-relaxed text-slate">{forShop ? "เปิดแจ้งเตือนเพื่อไม่พลาดออเดอร์ แม้ไม่ได้เปิดหน้านี้ไว้ เราแจ้งเฉพาะเรื่องออเดอร์ของร้าน" : "ไม่เปิดก็ได้ ดูสถานะออเดอร์ได้ที่หน้าออเดอร์เสมอ เราแจ้งเฉพาะ 2 เรื่องนี้เท่านั้น"}</p>
            </div>

            <ul className="flex flex-col gap-3.5 rounded-[20px] bg-white p-5">
                {(forShop ? SHOP_EVENTS : EVENTS).map((e) => (
                    <li key={e.text} className="flex items-center gap-3 text-base">
                        <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", e.tile)}>
                            <Icon name={e.icon} size={18} strokeWidth={2.4} />
                        </span>
                        {e.text}
                    </li>
                ))}
            </ul>

            {ios && (
                <p role="note" className="px-1 text-sm leading-relaxed text-slate">
                    iPhone: ต้องเพิ่มเว็บไปที่หน้าจอโฮมก่อน จึงจะเปิดแจ้งเตือนได้{" "}
                    <details className="mt-1 inline">
                        <summary className="inline cursor-pointer font-semibold text-primary-dark">ดูวิธี</summary>
                        <ol className="ml-5 mt-2 list-decimal space-y-1">
                            <li>เปิดเว็บนี้ด้วย Safari แล้วกดปุ่ม แชร์</li>
                            <li>เลือก “เพิ่มไปยังหน้าจอโฮม”</li>
                            <li>เปิดแอปจากหน้าจอโฮม แล้วกลับมาที่หน้านี้</li>
                        </ol>
                    </details>
                </p>
            )}

            <div className="mt-auto flex flex-col gap-2.5">
                <ActionButton full onClick={enable} disabled={busy || permission === "unsupported"}>
                    {busy ? "กำลังเปิด..." : permission === "granted" ? "ต่อไป" : "เปิดการแจ้งเตือน"}
                </ActionButton>
                <Link href={next} className="flex h-12 items-center justify-center text-base font-semibold text-primary-dark">ไว้ทีหลัง</Link>
            </div>
        </CenteredScreen>
    );
}
