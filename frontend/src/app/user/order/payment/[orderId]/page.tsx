"use client";

import { Button } from '@/components/Button';
import Input from '@/components/Input';
import CountdownTimer from '@/components/Timer';
import { toastDanger, toastSuccess } from '@/components/ui/Toast';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
import { OrderPaymentSchema, orderPaymentSchema } from '@/schemas/orderPaymentSchema';
import { getParamId } from '@/util/param';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Order } from '../../done/[orderId]/page';
import LoadingPage from '@/components/LoadingPage';
import { getIdempotencyKey } from '@/util/idempotency';
import { OrderStatus } from '@/components/cookers/OrderNavbar';

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
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<Order>();
    const [paymentImgUrl, setPaymentImgUrl] = useState<string>('');
    const failedCountRef = useRef(0);
    const hasRedirectedRef = useRef(false);
    const hasExpiredRef = useRef(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
                const orderResponse = await api.get(`order/${orderId}`, {
                    headers: { "x-order-secret": orderSecret }
                });

                failedCountRef.current = 0;
                const data = orderResponse.data;
                setOrder(data);

                if (!hasRedirectedRef.current && data.status === OrderStatus.completed) {
                    hasRedirectedRef.current = true
                    router.replace(`/user/order/done/${orderId}`);
                    return;
                }

                if (!hasRedirectedRef.current && (data.status === OrderStatus.cancelled || data.status === OrderStatus.rejected)) {
                    hasRedirectedRef.current = true
                    router.replace(`/user/order/failed/${orderId}`);
                    return;
                }

                if (!hasRedirectedRef.current && data.status === OrderStatus.sent) {
                    hasRedirectedRef.current = true
                    router.replace(`/user/order/wait/${orderId}`);
                    return;
                }

                let qrUrl = data.restaurant.paymentQr;
                try {
                    const qrResponse = await api.get(`payment/qr-code/${orderId}`, {
                        headers: { "x-order-secret": orderSecret }
                    });
                    const qrData = qrResponse.data;
                    if (typeof qrData === 'string' && qrData.length > 0) {
                        qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=400x400`;
                    } else if (qrData?.data?.qrImage || qrData?.qrImage) {
                        qrUrl = qrData?.data?.qrImage || qrData?.qrImage;
                    }
                } catch (qrErr) {
                    console.error("Failed to fetch dynamic QR code, using fallback", qrErr);
                }
                setPaymentImgUrl(qrUrl);

            } catch {
                failedCountRef.current += 1;

                if (failedCountRef.current >= 3) {
                    setIsFailed(true);
                    toastDanger("โหลดข้อมูลไม่สำเร็จ");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [orderId, router]);

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

            toastDanger("หมดเวลาชำระเงิน");
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
        "200401": "บัญชีผู้รับไม่ถูกต้อง",
        "200402": "จำนวนเงินไม่ตรงกับยอดที่ต้องชำระ",
        "200403": "วันที่โอนไม่ตรงเงื่อนไข",
        "200404": "ไม่พบข้อมูลสลิปในระบบธนาคาร",
        "200500": "สลิปไม่ถูกต้องหรืออาจเป็นสลิปปลอม",
        "200501": "สลิปนี้ถูกใช้ไปแล้ว",
    };

    const handlePayment = async (data: OrderPaymentSchema) => {
        try {
            if (!order || !orderId) {
                toastDanger("ไม่พบออเดอร์ของคุณ")
                return;
            }

            if (!data.paymentSlipImg) {
                toastDanger("กรุณาอัพโหลดสลิปก่อนสั่งอาหาร");
                return;
            }

            if (expired) {
                toastDanger("หมดเวลาแล้ว");
                router.replace(`/user/order/failed/${orderId}`);
                return;
            }

            if (!order.restaurantId) {
                toastDanger("ไม่พบข้อมูลร้านอาหาร");
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
                    headers: {
                        'x-order-secret': orderSecret
                    }
                }
            );

            if (!verifyResult?.success) {
                if (verifyResult?.retry) {
                    toastDanger("บันทึกการชำระเงินไม่สำเร็จ กรุณาลองส่งสลิปอีกครั้ง");
                } else if (verifyResult?.status === "initiated" || verifyResult?.status === "processing") {
                    toastDanger("ระบบกำลังตรวจสอบสลิป กรุณารอสักครู่");
                } else {
                    toastDanger("การชำระเงินไม่สำเร็จ");
                }
                setIsFailed(true);
                return;
            }

            toastSuccess("ชำระเงินสำเร็จ");

            setIsFailed(false)
            clearCart();
            localStorage.removeItem(`idempotencyKey:${orderId}`);

            router.push(`/user/order/done/${orderId}`);

        } catch (error: unknown) {
            setIsFailed(true)
            failedCountRef.current += 1;

            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };

                if (err.response.status === 409 && failedCountRef.current >= 1) {
                    toastDanger("ระบบกำลังตรวจสอบสลิป กรุณารอสักครู่");
                    return;
                }

                const backendMessage = err.response.data?.message;
                const code = err.response?.data?.code;

                toastDanger(code ? slipErrorMap[code] ?? backendMessage ?? "เกิดข้อผิดพลาด" : backendMessage ?? "เกิดข้อผิดพลาด");
            }
        }
    }

    const handleSlipUpload = (file: File) => {
        // 1. Validate size
        if (file.size > 2 * 1024 * 1024) {
            toastDanger("ไฟล์สลิปต้องไม่เกิน 2MB");
            return;
        }

        if (!file.type.startsWith("image/")) {
            toastDanger("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น");
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
            toastDanger("เกิดข้อผิดพลาดในการอ่านไฟล์");
        };

        reader.readAsDataURL(file);
    };

    if (loading) return <LoadingPage />
    if (!order) return <div>ไม่พบข้อมูลร้านค้า</div>;

    const paymentSlipImg = watch("paymentSlipImg");
    const isButtonDisabled = isSubmitting || expired || isLoading || !paymentSlipImg;

    const PAYMENT_WINDOW_MINS = 3;
    const baseTime = (order.acceptAt && new Date(order.acceptAt).getTime() > 0)
        ? new Date(order.acceptAt).getTime()
        : new Date(order.orderAt).getTime();
    const paymentDeadline = new Date(baseTime + PAYMENT_WINDOW_MINS * 60 * 1000);

    return (
        <form className="flex flex-col justify-center items-center py-10 px-6 gap-y-6" onSubmit={handleSubmit(handlePayment)}>
            <div className="flex flex-col gap-y-6">
                <h2 className="text-2xl font-semibold text-center">ชำระเงินออเดอร์ {orderId?.substring(0, 4)}</h2>
                <h3 className="text-red-500 font-bold text-center">ไม่รองรับการโอนเงินจากธนาคารกรุงเทพ</h3>
                <h3 className="text-red-500 font-bold text-center">Don&apos;t accept payment from bangkok bank</h3>

                <div className="flex flex-col gap-y-6">
                    <div className="flex flex-col w-full justify-center items-center gap-y-6">
                        <Image
                            src={paymentImgUrl}
                            loading="lazy"
                            alt="Payment QR picture"
                            width={300}
                            height={300}
                            className="object-cover aspect-square rounded-lg"
                        />

                        <CountdownTimer deadline={paymentDeadline} onExpire={handleExpire} />
                    </div>

                    <h2 className="flex flex-col w-full items-center font-noto-thai text-3xl font-semibold">{Number(order.totalAmount).toFixed(2)} บาท</h2>
                    <p className="flex flex-col w-full items-center text-xl font-bold font-noto-thai text-center">ยิ่งจ่ายเร็ว ร้านเริ่มทำอาหารได้ทันที</p>
                </div>

                {slipPreview && (
                    <div className="flex flex-col items-center gap-y-6">
                        <h2 className="w-full font-noto-thai text-bold text-start text-primary ">สลิปของคุณ</h2>

                        <Image
                            src={slipPreview}
                            alt="Payment slip preview"
                            width={250}
                            height={250}
                            className="object-cover aspect-square"
                        />
                    </div>
                )}

                <Input
                    type="file"
                    variant={paymentSlipImg ? "success" : "primary"}
                    label={paymentSlipImg ? "อัพโหลดสลิปสำเร็จ" : "ยังไม่ได้อัพโหลดสลิป"}
                    placeholder="อัพโหลดสลิปชำระเงิน"
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

                <div className=" w-full *:z-50 flex">
                    {isFailed ? (
                        <Button
                            className="w-full font-noto-thai text-bold py-4"
                            type="submit"
                            variant="secondaryDanger"
                            size="full"
                            disabled={isButtonDisabled}
                        >
                            {isSubmitting ? "กำลังส่งสลิป..." : "ลองใหม่อีกครั้ง"}
                        </Button>
                    ) : (
                        <Button
                            className="w-full font-noto-thai text-bold py-4"
                            type="submit"
                            variant="primary"
                            size="full"
                            disabled={isButtonDisabled}
                        >
                            {isSubmitting ? "กำลังส่งสลิป..." : "ส่งหลักฐานการชำระเงิน"}
                        </Button>
                    )}
                </div>
            </div>
        </form>
    )
}

export default OrderPaymentPage