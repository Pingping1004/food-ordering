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
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Order } from '../../done/[orderId]/page';
import LoadingPage from '@/components/LoadingPage';

export interface OrderPaymentPayload {
    restaurantId: string;
    orderId: string;
    paymentSlipImg: string;
}

function OrderPaymentPage() {
    const { cart, clearCart } = useCart();
    const router = useRouter();
    const params = useParams();
    const orderId = getParamId(params.orderId);

    const {
        watch,
        setValue,
        handleSubmit,
        register,
        formState: { errors, isSubmitting, isLoading }
    } = useForm({
        resolver: zodResolver(orderPaymentSchema),
        defaultValues: {
            paymentSlipImg: '',
        },
        mode: "onChange"
    });

    const [slipPreview, setSlipPreview] = useState<string | null>(null);
    const [expired, setExpired] = useState(false);
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<Order>();
    const [deadline,] = useState(() => Date.now() + 5 * 60 * 1000);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
                const orderResponse = await api.get(`order/${orderId}`, {
                    headers: {
                        "x-order-secret": orderSecret
                    }
                });
                setOrder(orderResponse.data);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [orderId, router]);

    useEffect(() => {
        return () => {
            if (slipPreview) URL.revokeObjectURL(slipPreview);
        };
    }, [slipPreview]);

    useEffect(() => {
        if (orderId) setValue("orderId", orderId);
        if (order?.restaurantId) setValue("restaurantId", order.restaurantId);
    }, [orderId, order, setValue]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();

            if (now >= deadline && expired) {
                clearInterval(interval);
                setExpired(true);
                toastDanger("หมดเวลาในการชำระเงิน")
                setTimeout(() => { router.replace(`/user/order/failed/${orderId}`) }, 2000);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [deadline, orderId, router]);

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

            if (!order.restaurantId) {
                toastDanger("ไม่พบข้อมูลร้านอาหาร");
                return;
            }

            const orderPaymentPayload: OrderPaymentPayload = {
                restaurantId: order.restaurantId,
                orderId: orderId,
                paymentSlipImg: data.paymentSlipImg,
            }

            await api.post(`/payment/verify`, orderPaymentPayload);

            toastSuccess("ชำระเงินสำเร็จและสร้างออเดอร์เรียบร้อย");
            clearCart();
            router.push(`/user/order/done/${orderId}`);

        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };

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

        const reader = new FileReader();

        reader.onloadend = () => {
            const base64DataUrl = reader.result as string;

            setValue("paymentSlipImg", base64DataUrl, {
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
    const paymentImgUrl = order.restaurant.paymentQr;
    const isButtonDisabled = isSubmitting || expired || isLoading || !paymentSlipImg;

    return (
        <form className="flex flex-col justify-center items-center py-10 px-6 gap-y-6" onSubmit={handleSubmit(handlePayment)}>
            <div className="flex flex-col gap-y-6">
                <h2 className="text-2xl font-semibold">ชำระเงินออเดอร์ {orderId?.substring(0, 4)}</h2>

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

                        <CountdownTimer duration={300} onExpire={() => setExpired(true)} />
                    </div>

                    <h2 className="flex flex-col w-full items-center font-noto-thai text-3xl font-semibold">{Number(order.totalAmount).toFixed(2)} บาท</h2>
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
                    accept="image/*"
                    error={errors.paymentSlipImg?.message as string | undefined}
                    {...register('paymentSlipImg')}
                    onChange={(e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;

                        const previewUrl = URL.createObjectURL(file);
                        setSlipPreview(previewUrl);

                        handleSlipUpload(file);
                    }}
                />

                <div className=" w-full *:z-50 flex">
                    <Button
                        className="w-full font-noto-thai text-bold py-4"
                        type="submit"
                        size="full"
                        disabled={isButtonDisabled}
                    >
                        {isSubmitting ? "กำลังส่งสลิป..." : "ส่งหลักฐานการชำระเงิน"}
                    </Button>
                </div>
            </div>
        </form>
    )
}

export default OrderPaymentPage