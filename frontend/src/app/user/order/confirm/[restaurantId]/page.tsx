"use client";

import { clearOrderSubmitKey, getOrderSubmitKey } from "@/util/idempotency";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/Button";
import { Stepper, StepHeader } from "@/components/users/Stepper";
import { PickupSlots } from "@/components/users/PickupSlots";
import { toastError, toastDanger, toastSuccess } from "@/components/ui/Toast";
import { useCooker } from "@/hook/useCooker";
import { api } from "@/lib/api";
import { createOrderSchema, type CreateOrderSchemaType } from "@/schemas/addOrderSchema";
import { routeForOrder } from "@/lib/order-flow";
import { todayHours, formatBaht } from "@/lib/schema/format";
import { trackEvent } from "@/lib/track";
import { Skeleton } from "@/components/ui/kit";

const OrderList = dynamic(() => import("@/components/users/OrderList"), { ssr: false });
const Input = dynamic(() => import("@/components/Input"), { ssr: false });

/** Body of POST /order/create – field names follow schema.prisma (`pickupAt`, `details`). */
export interface OrderPayload {
    restaurantId: string;
    pickupAt: Date;
    details?: string;
    /** Not in the new schema – only sent when the student typed one. */
    userTel?: string;
    orderMenus: { menuId: string; menuName: string; quantity: number; unitPrice: number; menuImg?: string }[];
}

/** accept window + payment window the kitchen/student need before cooking can start (minutes) */
const ACCEPT_WINDOW_MINS = 3;
const PAYMENT_WINDOW_MINS = 3;
const SYSTEM_BUFFER_MINS = ACCEPT_WINDOW_MINS + PAYMENT_WINDOW_MINS;

const slipErrorMap: Record<string, string> = {
    "200401": "สลิปนี้โอนไปบัญชีที่ไม่ใช่ของร้าน กรุณาตรวจสอบบัญชีผู้รับ",
    "200402": "ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ กรุณาโอนให้ตรงยอด",
    "200501": "สลิปนี้เคยถูกใช้ไปแล้ว กรุณาใช้สลิปใบใหม่",
};

const cookingMinsOf = (c?: { avgCookingTimeMins?: number | null; avgCookingTime?: number }) => c?.avgCookingTimeMins ?? c?.avgCookingTime ?? 5;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function OrderConfirmContext() {
    const params = useParams();
    const restaurantId = params.restaurantId as string;
    const { data: cooker, isLoading: cookerLoading } = useCooker(restaurantId);
    const { cart, hydrated, clearCart } = useCart();
    const router = useRouter();
    const isSubmittedRef = useRef(false);

    const cookingMins = cookingMinsOf(cooker);
    const earliest = useMemo(() => new Date(Date.now() + (SYSTEM_BUFFER_MINS + cookingMins + 1) * 60_000), [cookingMins]);
    const schema = useMemo(() => createOrderSchema(cookingMins), [cookingMins]);
    const closeAt = cooker?.closeTime ?? todayHours(cooker?.operatingHours)?.close;

    const { control, handleSubmit, register, reset, setValue, formState: { errors, isSubmitting, isValid } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { pickupAt: "", userTel: "", details: "" },
        mode: "onChange",
    });

    useEffect(() => {
        if (!cooker) return;
        reset({ pickupAt: hhmm(new Date(Math.ceil(earliest.getTime() / 900_000) * 900_000)), userTel: "", details: "", restaurantId: cooker.restaurantId });
        void trackEvent("checkout_started", { restaurantId: cooker.restaurantId });
    }, [cooker, earliest, reset]);

    useEffect(() => { if (cooker?.restaurantId) setValue("restaurantId", cooker.restaurantId); }, [cooker, setValue]);
    useEffect(() => { if (!cookerLoading && !cooker) toastDanger("ไม่พบข้อมูลร้านอาหาร", "ร้านอาจปิดหรือถูกลบไปแล้ว กรุณากลับไปเลือกร้านใหม่"); }, [cooker, cookerLoading]);

    // Resume an unfinished order instead of letting the student create a duplicate.
    useEffect(() => {
        const resume = async () => {
            const activeOrderId = localStorage.getItem("activeOrderId");
            if (!activeOrderId) return;
            const secret = localStorage.getItem(`orderSecret:${activeOrderId}`);
            if (!secret) return void localStorage.removeItem("activeOrderId");

            try {
                const res = await api.get(`/order/${activeOrderId}`, { headers: { "x-order-secret": secret } });
                const target = routeForOrder(activeOrderId, res.data);
                if (target.includes("/payment/") || target.includes("/wait/")) router.replace(target);
                else localStorage.removeItem("activeOrderId");
            } catch {
                localStorage.removeItem("activeOrderId");
            }
        };
        void resume();
    }, [router]);

    useEffect(() => {
        if (hydrated && cart.length === 0 && !isSubmittedRef.current) router.replace("/user/restaurant");
    }, [hydrated, cart.length, router]);

    const totalAmount = useMemo(() => cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0), [cart]);
    const isButtonDisabled = isSubmitting || !isValid || cart.length === 0;

    if (!cooker || !hydrated) {
        return (
            <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]">
                <div className="flex h-14 items-center justify-between border-b border-line-soft bg-white px-4">
                    <Skeleton className="h-6 w-32 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4">
                    <div className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-4">
                        <Skeleton className="h-5 w-28 rounded-md" />
                        <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                    <div className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-4">
                        <Skeleton className="h-5 w-24 rounded-md" />
                        <Skeleton className="h-16 w-full rounded-xl" />
                        <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                    <div className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-4">
                        <Skeleton className="h-5 w-32 rounded-md" />
                        <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    const submitOrder = async (data: CreateOrderSchemaType) => {
        if (cart.length === 0) return void toastDanger("ตะกร้าสินค้าว่างเปล่า", "กรุณาเลือกเมนูอาหารอย่างน้อย 1 รายการก่อนสั่ง");

        const payload: OrderPayload = {
            restaurantId: cooker.restaurantId,
            pickupAt: new Date(data.pickupAt),
            orderMenus: cart.map((i) => ({ menuId: i.menuId, menuName: i.menuName, quantity: i.quantity, unitPrice: i.unitPrice, menuImg: i.menuImg })),
            ...(data.details ? { details: data.details } : {}),
            ...(data.userTel ? { userTel: data.userTel } : {}),
        };

        try {
            const signature = JSON.stringify([payload.restaurantId, new Date(data.pickupAt).toISOString(), payload.details ?? "", cart.map((i) => `${i.menuId}:${i.quantity}`).sort()]);
            const { data: result } = await api.post("/order/create", payload, { headers: { "Idempotency-Key": getOrderSubmitKey(signature) } });
            clearOrderSubmitKey();
            localStorage.setItem(`orderSecret:${result.orderId}`, result.orderSecret);
            localStorage.setItem("activeOrderId", result.orderId);

            isSubmittedRef.current = true;
            toastSuccess("สร้างออเดอร์เรียบร้อย");
            clearCart();
            // accept first: the student waits for the shop (or auto-accept), then pays
            router.replace(routeForOrder(result.orderId, { status: result.status ?? "receive", paymentStatus: result.paymentStatus ?? "UNPAID", acceptAt: result.acceptAt }));
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string; code?: string } } };
            const code = err.response?.data?.code;
            if (code && slipErrorMap[code]) toastDanger(slipErrorMap[code]);
            else toastError("สร้างออเดอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", error);
        }
    };

    const card = "flex flex-col gap-3.5 rounded-[20px] border border-line-soft bg-white p-[18px]";

    return (
        <form className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]" onSubmit={handleSubmit(submitOrder)}>
            <StepHeader title="ยืนยันออเดอร์" backHref={`/user/restaurant/${cooker.restaurantId}`} backLabel="กลับไปเมนู" />
            <Stepper current={1} />

            <main className="flex flex-1 flex-col gap-4 p-4">
                <section className={card}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-[17px] font-bold">{cooker.name}</h2>
                        <Link href={`/user/restaurant/${cooker.restaurantId}`} className="flex min-h-11 items-center text-[15px] font-semibold text-primary-dark">+ เพิ่มเมนู</Link>
                    </div>
                    <OrderList items={cart} />
                    <label className="flex flex-col gap-2 pt-1 text-[15px] font-semibold">
                        หมายเหตุถึงร้าน (ไม่บังคับ)
                        <textarea rows={2} maxLength={200} placeholder="เช่น ไม่เผ็ด ไม่ใส่ผัก" {...register("details")} className="resize-none rounded-xl border-[1.5px] border-line px-3.5 py-3 text-base font-normal outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20" />
                        {errors.details && <span role="alert" className="text-sm font-medium text-danger-text">{errors.details.message}</span>}
                    </label>
                </section>

                <section className={card}>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[17px] font-bold">จะมารับกี่โมง?</h2>
                        <span className="text-sm text-brand-muted">ร้านจะทำให้เสร็จพอดีเวลาที่เลือก · รับได้หลัง {hhmm(earliest)}</span>
                    </div>
                    <Controller name="pickupAt" control={control} render={({ field }) => <PickupSlots value={field.value} onChange={field.onChange} earliest={earliest} closeAt={closeAt} error={errors.pickupAt?.message} />} />
                </section>

                <section className={card}>
                    <Input type="tel" label="เบอร์โทรให้ร้านติดต่อ (ไม่บังคับ)" placeholder="0xxxxxxxxx" autoComplete="tel" {...register("userTel")} error={errors.userTel?.message} />
                    <span className="text-[13px] leading-normal text-brand-muted">ใช้เฉพาะติดต่อเรื่องออเดอร์นี้ โรงเรียนไม่เห็นเบอร์ของคุณ</span>
                </section>
            </main>

            <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-line-soft bg-white px-4 pb-5 pt-4">
                <div className="flex items-baseline justify-between">
                    <span className="text-base text-brand-muted">ยอดรวม</span>
                    <span className="text-2xl font-bold">{formatBaht(totalAmount)} บาท</span>
                </div>
                <Button type="submit" size="full" disabled={isButtonDisabled}>
                    {isSubmitting ? "กำลังส่งคำสั่งซื้อ..." : "ยืนยันออเดอร์"}
                </Button>
            </footer>
        </form>
    );
}

export default function OrderConfirmPage() {
    return <OrderConfirmContext />;
}
