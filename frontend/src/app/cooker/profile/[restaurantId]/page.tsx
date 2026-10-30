"use client";

import { TextSizeSetting } from "@/components/TextSizeSetting";
import { useCallback, useEffect, useState } from 'react'
import { Toggle } from '@/components/Toggle';
import { useParams } from 'next/navigation';
import { useAuth } from '@/auth/auth.hooks';
import { isSystemAdmin, restaurantRole } from '@/auth/access';
import { CookerShell } from '@/components/cookers/CookerShell';
import { useCooker, useToggleRestaurantClosed, useToggleRestaurantAutoAccept, useUpdateRestaurantSettings, type RestaurantSettingsPatch } from '@/hook/useCooker';
import { HoursDialog } from '@/components/cookers/HoursDialog';
import { EditBankDialog, EditCookingTimeDialog, EditMaxOrdersDialog } from '@/components/cookers/SettingEditors';
import Link from 'next/link';
import { Icon } from '@/components/ui/kit';
import { PAYMENT_SOUND_KEY, isPaymentSoundEnabled, useOrderSounds } from '@/hook/useOrderSounds';
import { getNotificationPermission } from '@/lib/firebase-messaging';
import { CATEGORY_LABEL, summarizeHours, todayHours } from '@/lib/schema/format';
import { BANKS, type AccountType } from '@/common/bank-type.enum';

function Page() {
    const params = useParams();
    const restaurantId = (params.restaurantId) as string;
    const { data: cooker } = useCooker(restaurantId);
    const { mutate: toggleClosed, isPending: isPatching } = useToggleRestaurantClosed(restaurantId);
    const { mutate: toggleAutoAccept, isPending: isPatchingAutoAccept } = useToggleRestaurantAutoAccept(restaurantId);
    const { mutate: updateSettings, isPending: isSavingSettings } = useUpdateRestaurantSettings(restaurantId);
    const [editing, setEditing] = useState<'hours' | 'maxOrders' | 'cookingTime' | 'bank' | null>(null);
    const { user, logout } = useAuth();
    // Hours, capacity, cooking time and the payout account are the owner's to change; cooks see them read-only.
    const canEditShop = restaurantRole(user, restaurantId) === 'OWNER' || isSystemAdmin(user);
    const [error,] = useState(null);
    const { playNewOrderSound, playPaymentSound } = useOrderSounds();
    const [paymentSoundOn, setPaymentSoundOn] = useState(true);
    const [soundOn, setSoundOn] = useState(false);

    useEffect(() => {
        setSoundOn(getNotificationPermission() === "granted");
        setPaymentSoundOn(isPaymentSoundEnabled());
    }, []);

    const choosePaymentSound = (value: boolean) => {
        setPaymentSoundOn(value);
        try { localStorage.setItem(PAYMENT_SOUND_KEY, value ? "on" : "off"); } catch { /* storage blocked: keeps the default (on) */ }
    };

    const saveSettings = (patch: RestaurantSettingsPatch) =>
        updateSettings(patch, { onSuccess: () => setEditing(null) });

    const toggleCheckedState = cooker?.isTemporarilyClosed;
    const handleRestaurantAvailabilityChange = useCallback(
        (newIsTemporarilyClosed: boolean) => {
          toggleClosed(newIsTemporarilyClosed);
        },
        [toggleClosed]
    );

    const toggleAutoAcceptState = cooker?.isAutoAcceptedOrder;
    const handleAutoAcceptChange = useCallback(
        (newIsAutoAcceptedOrder: boolean) => {
          toggleAutoAccept(newIsAutoAcceptedOrder);
        },
        [toggleAutoAccept]
    );

    if (!cooker) return <div className="p-6 font-app">Loading restaurant profile...</div>
    if (error) return <div>Error</div>

    const toggles = [
        { id: restaurantId, label: "ปิดร้านชั่วคราว", hint: "นักเรียนจะสั่งไม่ได้จนกว่าจะเปิดอีกครั้ง", checked: toggleCheckedState || false, disabled: isPatching, onChange: handleRestaurantAvailabilityChange },
        { id: `auto-accept-${restaurantId}`, label: "รับออเดอร์อัตโนมัติ", hint: "ไม่ต้องกดรับเอง เหมาะช่วงคนเยอะ", checked: toggleAutoAcceptState || false, disabled: isPatchingAutoAccept, onChange: handleAutoAcceptChange },
    ];

    return (
        <CookerShell restaurantId={cooker.restaurantId} active="settings">
            <header className="border-b border-line-soft bg-white p-5">
                <h1 className="text-[28px] font-bold">ตั้งค่าร้าน</h1>
                <p className="mt-1 text-base text-brand-muted">{cooker.name}{(cooker.openTime ?? todayHours(cooker.operatingHours)?.open) ? ` · เปิด ${cooker.openTime ?? todayHours(cooker.operatingHours)?.open}–${cooker.closeTime ?? todayHours(cooker.operatingHours)?.close}` : ""}</p>
            </header>

            <main className="flex flex-col gap-4 p-5">
                <section className="rounded-[20px] border border-line-soft bg-white px-[18px] py-1.5">
                    {toggles.map((t, i) => (
                        <div key={t.id} className={`flex items-center gap-3.5 py-4 ${i < toggles.length - 1 ? "border-b border-[#EEF1F6]" : ""}`}>
                            <span className="flex flex-1 flex-col gap-1">
                                <span className="text-xl font-bold">{t.label}</span>
                                <span className="text-base leading-snug text-brand-muted">{t.hint}</span>
                            </span>
                            <Toggle id={t.id} label={t.label} checked={t.checked} disabled={t.disabled} onCheckedChange={t.onChange} />
                        </div>
                    ))}
                </section>

                <TextSizeSetting />

                <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-[18px]">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-bold">เสียงแจ้งออเดอร์ใหม่</h2>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-bold ${soundOn ? "bg-success-light text-success-main" : "bg-danger-light text-danger-text"}`}>
                            <Icon name={soundOn ? "check" : "alert"} size={16} strokeWidth={2.6} />
                            {soundOn ? "เปิดอยู่" : "ยังไม่ได้เปิด"}
                        </span>
                    </div>
                    <button type="button" onClick={playNewOrderSound} className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-primary-main bg-white text-lg font-semibold text-primary-dark hover:bg-ground-blue">
                        <Icon name="bell" size={22} />ลองฟังเสียง
                    </button>
                    <Link href={`/cooker/${restaurantId}`} className="flex min-h-11 items-center text-base font-semibold text-primary-dark underline">ไม่มีเสียง? ดูวิธีติดตั้งแอปบนมือถือ</Link>
                </section>

                <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-[18px]">
                    <div className="flex items-center gap-3.5">
                        <span className="flex flex-1 flex-col gap-1">
                            <h2 className="text-xl font-bold">เสียงแจ้งชำระเงินแล้ว</h2>
                            <span className="text-base leading-snug text-brand-muted">ดังเมื่อออเดอร์ที่รับไว้แล้วมีการชำระเงินและตรวจสอบสำเร็จ</span>
                        </span>
                        <Toggle id={`payment-sound-${restaurantId}`} label="เสียงแจ้งชำระเงินแล้ว" checked={paymentSoundOn} onCheckedChange={choosePaymentSound} />
                    </div>
                    <button type="button" onClick={() => playPaymentSound(true)} className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-primary-main bg-white text-lg font-semibold text-primary-dark hover:bg-ground-blue">
                        <Icon name="bell" size={22} />ลองฟังเสียง
                    </button>
                </section>

                <section className="rounded-[20px] border border-line-soft bg-white px-[18px] py-1">
                    {[
                        { label: "เวลาเปิด-ปิด", value: cooker.operatingHours?.length ? summarizeHours(cooker.operatingHours) : "ตั้งเวลาเปิดร้าน", href: undefined, onEdit: canEditShop ? () => setEditing("hours") : undefined },
                        { label: "รับได้พร้อมกันสูงสุดต่อรอบ", value: cooker.maxActiveOrders ? `${cooker.maxActiveOrders} ออเดอร์` : "ไม่จำกัด", href: undefined, onEdit: canEditShop ? () => setEditing("maxOrders") : undefined },
                        { label: "เวลาทำอาหารเฉลี่ย", value: cooker.avgCookingTimeMins ? `${cooker.avgCookingTimeMins} นาที / เมนู` : "ยังไม่ระบุ", href: undefined, onEdit: canEditShop ? () => setEditing("cookingTime") : undefined },
                        { label: "บัญชีรับเงิน", value: cooker.accountName ? `${cooker.bankType && BANKS[cooker.bankType as AccountType] ? `${BANKS[cooker.bankType as AccountType].label} · ` : ""}${cooker.accountName}${cooker.accountNumber ? ` ···· ${cooker.accountNumber.slice(-4)}` : ""}` : "ดูในใบสมัคร", href: undefined, onEdit: canEditShop ? () => setEditing("bank") : undefined },
                        { label: "ข้อมูลร้าน", value: [cooker.categories?.map((c) => CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c).join(", "), cooker.avgCookingTimeMins ? `${cooker.avgCookingTimeMins} นาที/จาน` : ""].filter(Boolean).join(" · ") || "ชื่อ รูป เบอร์ติดต่อ", href: undefined },
                    ].map((l, i, arr) => {
                        const body = (
                            <>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="text-lg font-semibold">{l.label}</span>
                                    <span className="truncate text-base text-brand-muted">{l.value}</span>
                                </span>
                                {(l.href || l.onEdit) && <Icon name="chevron" size={22} className="text-brand-muted" />}
                            </>
                        );
                        const cls = `flex min-h-16 items-center gap-3 ${i < arr.length - 1 ? "border-b border-row-line" : ""}`;
                        if (l.href) return <Link key={l.label} href={l.href} className={cls}>{body}</Link>;
                        if (l.onEdit) return <button key={l.label} type="button" onClick={l.onEdit} aria-label={`แก้ไข${l.label}`} className={`${cls} w-full text-left hover:bg-ground`}>{body}</button>;
                        return <div key={l.label} className={cls}>{body}</div>;
                    })}
                </section>

                <button
                    type="button"
                    onClick={() => logout()}
                    className="h-[60px] rounded-2xl border-[1.5px] border-line bg-white text-xl font-semibold text-danger-text"
                >
                    ออกจากระบบ
                </button>
            </main>
            {editing === 'hours' && <HoursDialog restaurantId={restaurantId} onClose={() => setEditing(null)} />}
            {editing === 'maxOrders' && <EditMaxOrdersDialog cooker={cooker} saving={isSavingSettings} onSave={saveSettings} onClose={() => setEditing(null)} />}
            {editing === 'cookingTime' && <EditCookingTimeDialog cooker={cooker} saving={isSavingSettings} onSave={saveSettings} onClose={() => setEditing(null)} />}
            {editing === 'bank' && <EditBankDialog cooker={cooker} saving={isSavingSettings} onSave={saveSettings} onClose={() => setEditing(null)} />}
        </CookerShell>
    )
}

export default function RestaurantProfilePage() {
    return (
        <Page />
    )
}
