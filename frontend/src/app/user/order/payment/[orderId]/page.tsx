"use client";

import { Button } from '@/components/Button';
import Input from '@/components/Input';
import CountdownTimer from '@/components/Timer';
import { Stepper, StepHeader } from '@/components/users/Stepper';
import { toastError, toastDanger, toastSuccess } from '@/components/ui/Toast';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
import { OrderPaymentSchema, orderPaymentSchema } from '@/schemas/orderPaymentSchema';
import { getParamId } from '@/util/param';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { paymentDeadline, routeForOrder, screenForOrder } from '@/lib/order-flow';
import { formatBaht, orderCode } from '@/lib/schema/format';
import { OrderTrackingSkeleton } from '@/components/ui/Skeleton';
import { getIdempotencyKey } from '@/util/idempotency';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { studentOrderKey, studentOrderStateKey, useStudentOrder } from '@/hook/useStudentOrder';

export interface OrderPaymentPayload {
    idempotencyKey: string;
    orderId: string;
    paymentSlipImg: string;
}

function OrderPaymentPage() {
    const { clearCart } = useCart();
    const router = useRouter();
    const params = useParams();
    const orderId = getParamId(params.orderId);

    const {
        watch,
        setValue,
        handleSubmit,
        formState: { errors, isSubmitting, isLoading }
    } = useForm({
        resolver: zodResolver(orderPaymentSchema),
        defaultValues: {
            paymentSlipImg: '',
        },
        mode: "onChange"
    });

    const [slipPreview, setSlipPreview] = useState<string | null>(null);
    const [isFailed, setIsFailed] = useState(false);
    const [expired, setExpired] = useState(false);
    const [qrFailed, setQrFailed] = useState(false);
    const failedCountRef = useRef(0);
    const hasRedirectedRef = useRef(false);
    const hasExpiredRef = useRef(false);

    // Shared cache with the wait/shop-list screens; retried on network/5xx errors (a single blip used to dead-end the page).
    const queryClient = useQueryClient();
    const orderQuery = useStudentOrder(orderId);
    const order = orderQuery.data;
    const loading = orderQuery.isPending;

    useEffect(() => {
        if (orderQuery.isError && !order) toastError("โหลดข้อมูลการชำระเงินไม่สำเร็จ", orderQuery.error);
    }, [orderQuery.isError, orderQuery.error, order]);

    useEffect(() => {
        // This screen only exists while the order is still unpaid; anything else belongs elsewhere. Fresh data only.
        if (!order || !orderQuery.isFetchedAfterMount || hasRedirectedRef.current) return;
        if (screenForOrder(order) !== 'payment') {
            hasRedirectedRef.current = true;
            router.replace(routeForOrder(orderId!, order));
        }
    }, [order, orderQuery.isFetchedAfterMount, orderId, router]);

    // Default: the shop's uploaded static QR. Set NEXT_PUBLIC_DYNAMIC_QR=true to generate an amount-locked QR instead.
    const dynamicQr = useQuery({
        queryKey: ["payment-qr", orderId],
        enabled: process.env.NEXT_PUBLIC_DYNAMIC_QR === 'true' && !!order,
        staleTime: Infinity,
        retry: false,
        queryFn: async () => {
            const qrData = (await api.get(`payment/qr-code/${orderId}`, {
                headers: { "x-order-secret": localStorage.getItem(`orderSecret:${orderId}`) }
            })).data;
            if (typeof qrData === 'string' && qrData.length > 0) {
                return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=400x400`;
            }
            return (qrData?.data?.qrImage || qrData?.qrImage || null) as string | null;
        },
    });
    const paymentImgUrl: string = dynamicQr.data || order?.restaurant?.paymentQr || '';

    useEffect(() => {
        if (orderId) setValue("orderId", orderId);
    }, [orderId, setValue]);

    const handleExpire = useCallback(async () => {
        console.log("handleExpire is activated");
        if (!orderId || hasExpiredRef.current) {
            console.log("No orderId or hasExpiredRef")
            return
        };

        const expireLockKey = `orderExpireRequested:${orderId}`;
        const isRequesting = sessionStorage.getItem(expireLockKey);

        if (isRequesting) {
            console.log("Already requesting expire for orderId:", orderId);
            return;
        }

        sessionStorage.setItem(expireLockKey, 'true');
        setExpired(true);
        hasExpiredRef.current = true;

        try {
            const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
            await api.patch(`/order/expire/${orderId}`, {}, {
                headers: { "x-order-secret": orderSecret }
            });

            toastDanger("หมดเวลาชำระเงินแล้ว", "ออเดอร์นี้ถูกยกเลิก กรุณาสั่งอาหารใหม่อีกครั้ง");
            router.replace(`/user/order/failed/${orderId}`);
        } catch (error) {
            console.error("Error setting order to expired:", error);
        } finally {
            sessionStorage.removeItem(expireLockKey);
        }
    }, [orderId, router]);

    useEffect(() => {
        if (!isSubmitting) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "ระบบกำลังตรวจสอบการชำระเงิน คุณต้องการออกจากหน้านี้หรือไม่?";
            return e.returnValue;
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [isSubmitting]);

    useEffect(() => {
        return () => {
            if (slipPreview) URL.revokeObjectURL(slipPreview);
        };
    }, [slipPreview]);

    const slipErrorMap: Record<string, string> = {
        "200000": "พบข้อมูลสลิปในระบบธนาคาร",
        "200001": "ขอข้อมูลสลิปสำเร็จ",
        "200200": "สลิปถูกต้อง",
        "200401": "สลิปนี้โอนไปบัญชีที่ไม่ใช่ของร้าน กรุณาตรวจสอบบัญชีผู้รับ",
        "200402": "ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ กรุณาโอนให้ตรงยอด",
        "200403": "วันที่โอนในสลิปไม่ตรงเงื่อนไข กรุณาใช้สลิปที่โอนวันนี้",
        "200404": "ธนาคารยังไม่พบรายการโอนนี้ กรุณารอสักครู่แล้วลองส่งอีกครั้ง",
        "200500": "สลิปนี้อ่านไม่ผ่านหรืออาจไม่ใช่สลิปจริง กรุณาใช้สลิปจากแอปธนาคาร",
        "200501": "สลิปนี้เคยถูกใช้ไปแล้ว กรุณาใช้สลิปใบใหม่",
    };

    /** Slip2Go result codes → reason shown on the dedicated "slip failed" screen. */
    const reasonForCode = (code?: string) => {
        switch (code) {
            case "200401": return "account";
            case "200402": return "amount";
            case "200501": return "duplicate";
            case "200404":
            case "200500":
            case "200403": return "unreadable";
            default: return undefined;
        }
    };

    const handlePayment = async (data: OrderPaymentSchema) => {
        try {
            if (!order || !orderId) {
                toastDanger("ไม่พบออเดอร์ของคุณ", "กรุณากลับไปหน้าแรกแล้วสั่งอาหารใหม่อีกครั้ง")
                return;
            }

            if (!data.paymentSlipImg) {
                toastDanger("ยังไม่ได้แนบสลิป", "กรุณาโอนเงินแล้วแนบรูปสลิปก่อนกดยืนยัน");
                return;
            }

            if (expired) {
                toastDanger("หมดเวลาชำระเงินแล้ว", "ออเดอร์นี้ถูกยกเลิก กรุณาสั่งอาหารใหม่อีกครั้ง");
                router.replace(`/user/order/failed/${orderId}`);
                return;
            }

            if (!order.restaurantId) {
                toastDanger("ไม่พบข้อมูลร้านอาหาร", "ร้านอาจปิดหรือถูกลบไปแล้ว กรุณากลับไปเลือกร้านใหม่");
                return;
            }

            const idempotencyKey = getIdempotencyKey(orderId);
            const orderPaymentPayload: OrderPaymentPayload = {
                idempotencyKey: idempotencyKey,
                orderId: orderId,
                paymentSlipImg: data.paymentSlipImg,
            }

            const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
            const { data: verifyResult } = await api.post<{ success: boolean; retry?: boolean; status?: string }>(
                `/payment/verify`,
                orderPaymentPayload,
                {
                    // Same key in the header lets api.ts retry a 429/503 safely (the server dedupes by this key).
                    headers: {
                        'x-order-secret': orderSecret,
                        'Idempotency-Key': idempotencyKey,
                    }
                }
            );

            if (!verifyResult?.success) {
                if (verifyResult?.retry) {
                    toastDanger("บันทึกการชำระเงินไม่สำเร็จ", "ระบบขัดข้องชั่วคราว กรุณาส่งสลิปอีกครั้ง");
                } else if (verifyResult?.status === "initiated" || verifyResult?.status === "processing") {
                    toastDanger("ระบบกำลังตรวจสอบสลิป กรุณารอสักครู่");
                } else {
                    toastDanger("การชำระเงินไม่สำเร็จ", "ระบบตรวจสลิปไม่ผ่าน กรุณาตรวจสลิปแล้วลองส่งอีกครั้ง");
                }
                setIsFailed(true);
                return;
            }

            toastSuccess("ชำระเงินสำเร็จ");

            setIsFailed(false)
            clearCart();
            localStorage.removeItem(`idempotencyKey:${orderId}`);
            // The cached copy still says UNPAID; drop it so the next screens never paint a stale "please pay".
            hasRedirectedRef.current = true;
            queryClient.removeQueries({ queryKey: studentOrderKey(orderId) });
            queryClient.removeQueries({ queryKey: studentOrderStateKey(orderId) });

            router.push(`/user/order/wait/${orderId}`);

        } catch (error: unknown) {
            setIsFailed(true)
            failedCountRef.current += 1;

            const err = error as { response?: { status?: number; data?: { message?: string, code?: string } } };

            if (err.response?.status === 409 && failedCountRef.current >= 1) {
                toastDanger("ระบบกำลังตรวจสอบสลิป กรุณารอสักครู่");
                return;
            }

            const code = err.response?.data?.code;

            const reason = reasonForCode(code);
            if (reason) {
                router.push(`/user/order/slip-failed/${orderId}?reason=${reason}`);
                return;
            }

            if (code && slipErrorMap[code]) toastDanger(slipErrorMap[code]);
            else toastError("ส่งสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", error);
        }
    }

    const handleSlipUpload = (file: File) => {
        // 1. Validate size
        if (file.size > 2 * 1024 * 1024) {
            toastDanger("ไฟล์สลิปใหญ่เกินไป", "กรุณาเลือกรูปที่มีขนาดไม่เกิน 2MB");
            return;
        }

        if (!file.type.startsWith("image/")) {
            toastDanger("ไฟล์ที่เลือกไม่ใช่รูปภาพ", "กรุณาเลือกรูปสลิปที่เป็นไฟล์รูป เช่น JPG หรือ PNG");
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setSlipPreview(previewUrl);

        const reader = new FileReader();

        reader.onloadend = () => {
            const base64 = reader.result as string;

            setValue("paymentSlipImg", base64, {
                shouldValidate: true,
                shouldDirty: true,
            });
        };

        reader.onerror = () => {
            toastDanger("เปิดไฟล์รูปนี้ไม่ได้", "กรุณาลองเลือกรูปสลิปใหม่อีกครั้ง");
        };

        reader.readAsDataURL(file);
    };

    const [copied, setCopied] = useState(false);

    if (loading) return <OrderTrackingSkeleton />;
    if (!order) return <div>ไม่พบข้อมูลร้านค้า</div>;

    const paymentSlipImg = watch("paymentSlipImg");
    const isButtonDisabled = isSubmitting || expired || isLoading || !paymentSlipImg;

    const deadline = paymentDeadline(order);

    const copyAmount = async () => {
        try {
            await navigator.clipboard.writeText(Number(order?.totalAmount ?? 0).toFixed(2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard unavailable */ }
    };

    const saveQr = async () => {
        if (!paymentImgUrl) return;
        try {
            const blob = await (await fetch(paymentImgUrl)).blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `qr-${orderCode(order.orderId)}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch {
            window.open(paymentImgUrl, "_blank", "noopener,noreferrer"); // cross-origin image: let the browser save it
        }
    };

    const card = "flex flex-col gap-3.5 rounded-[20px] border border-line-soft bg-white p-[18px]";

    return (
        <form className="mx-auto flex min-h-app w-full max-w-[640px] md:max-w-[720px] flex-col bg-ground font-app text-brand-dark" onSubmit={handleSubmit(handlePayment)}>
            <StepHeader
                title="ชำระเงิน"
                right={<CountdownTimer deadline={deadline} onExpire={handleExpire} />}
            />
            <Stepper current={2} />

            <main className="flex flex-1 flex-col gap-4 p-4">
                <section className={`${card} items-center`}>
                    <span className="text-[15px] text-brand-muted">ยอดที่ต้องโอน · ออเดอร์ {orderCode(order.orderId)}</span>
                    <span className="text-[40px] font-bold leading-none">
                        {formatBaht(order.totalAmount)} <span className="text-xl">บาท</span>
                    </span>
                    {paymentImgUrl && !qrFailed && (
                        // Plain <img>, not next/image: next/image THROWS (blank "Application error" page) for a src that is
                        // not an allow-listed host or is malformed, which would stop the student paying at all.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={paymentImgUrl}
                            alt={`QR พร้อมเพย์สำหรับชำระเงิน`}
                            width={220}
                            height={220}
                            onError={() => setQrFailed(true)}
                            className="aspect-square rounded-2xl border-2 border-brand-dark object-cover"
                        />
                    )}
                    {qrFailed && <span className="text-center text-sm text-danger-main">โหลด QR ไม่สำเร็จ กรุณาโทรหาร้านหรือสแกนจากหน้าร้าน</span>}
                    <button type="button" onClick={copyAmount} className="flex h-12 items-center gap-2 rounded-xl bg-primary-main px-5 text-base font-semibold text-white hover:bg-primary-dark">
                        {copied ? 'คัดลอกแล้ว ✓' : `คัดลอกยอด ${formatBaht(order.totalAmount)} บาท`}
                    </button>
                    <span className="flex flex-col items-center gap-0.5 text-center">
                        {order.restaurant?.name && <span className="text-base font-bold">{order.restaurant.name}</span>}
                        {order.restaurant?.accountName && <span className="text-sm text-brand-muted">ชื่อบัญชี: {order.restaurant.accountName}</span>}
                    </span>
                    {paymentImgUrl && (
                        <button type="button" onClick={saveQr} className="flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-primary-main bg-white px-5 text-base font-semibold text-primary-dark hover:bg-ground-blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                            บันทึกรูป QR
                        </button>
                    )}
                    <span className="text-[15px] text-brand-muted">ยิ่งจ่ายเร็ว ร้านเริ่มทำอาหารได้ทันที</span>
                </section>

                <div role="note" className="flex gap-3 rounded-2xl bg-danger-light px-4 py-3.5">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-px shrink-0"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg>
                    <span className="text-[15px] leading-normal"><b>ยังไม่รองรับการโอนจากธนาคารกรุงเทพ</b> กรุณาใช้บัญชีธนาคารอื่น</span>
                </div>

                <section className={card}>
                    <h2 className="text-[17px] font-bold">โอนแล้ว? ส่งสลิปให้ร้าน</h2>
                    {slipPreview && (
                        <Image
                            src={slipPreview}
                            alt="สลิปของคุณ"
                            width={250}
                            height={250}
                            className="aspect-square self-center rounded-xl object-cover"
                        />
                    )}
                    <Input
                        type="file"
                        variant={paymentSlipImg ? "success" : "primary"}
                        label={paymentSlipImg ? "อัพโหลดสลิปสำเร็จ" : "ยังไม่ได้อัพโหลดสลิป"}
                        placeholder="แตะเพื่อเลือกรูปสลิป (JPG/PNG ไม่เกิน 2MB)"
                        id="paymentSlipImg"
                        name="paymentSlipImg"
                        accept="image/*"
                        error={errors.paymentSlipImg?.message as string | undefined}
                        onChange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;

                            handleSlipUpload(file);
                        }}
                    />
                    <span className="text-[13px] leading-normal text-brand-muted">ระบบตรวจยอดเงินและบัญชีผู้รับให้อัตโนมัติ ใช้เวลาไม่กี่วินาที</span>
                </section>
            </main>

            <footer className="sticky bottom-0 flex flex-col gap-2.5 border-t border-line-soft bg-white px-4 pb-5 pt-4">
                <Button
                    type="submit"
                    variant={isFailed ? "danger" : "primary"}
                    size="full"
                    disabled={isButtonDisabled}
                >
                    {isSubmitting ? "กำลังส่งสลิป..." : isFailed ? "ลองใหม่อีกครั้ง" : "ส่งสลิป"}
                </Button>
                {!paymentSlipImg && <span className="text-center text-[13px] text-brand-muted">ปุ่มจะกดได้เมื่อเลือกรูปสลิปแล้ว</span>}
            </footer>
        </form>
    )
}

export default OrderPaymentPage