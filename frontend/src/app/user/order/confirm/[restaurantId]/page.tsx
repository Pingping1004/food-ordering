"use client";

import dynamic from 'next/dynamic';
import { useCart } from '@/context/CartContext';
import { OrderMenuType } from '@/components/users/OrderList';
import TimePickerInput from '@/components/ui/TimePicker';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { useForm, Controller } from 'react-hook-form';
import { createOrderSchema, CreateOrderSchemaType } from '@/schemas/addOrderSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toastDanger } from '@/components/ui/Toast';
import Image from 'next/image';
import { toastSuccess } from '@/components/ui/Toast';
import { useEffect, useMemo, useState } from 'react';
import { useCooker } from '@/context/Cookercontext';

const OrderList = dynamic(() => import("@/components/users/OrderList"), { ssr: false })
const CountdownTimer = dynamic(() => import("@/components/Timer"))
const Input = dynamic(() => import("@/components/Input"), { ssr: false })

interface orderPaymentPayload {
    paymentSlipImg: string;
    restaurantId: string;
    paidAt: Date;
    deliverAt: Date;
    userTel: string;
    orderMenus: OrderMenuType[];
}

const getRequiredBufferMinutes = (): number => 5;

const getBufferTime = (): string => {
    const now = new Date();
    const bufferMins = getRequiredBufferMinutes() + 1;
    const minimumAllowedDeliverTime = new Date(now.getTime() + bufferMins * 60 * 1000);
    const hours = minimumAllowedDeliverTime.getHours().toString().padStart(2, '0');
    const minutes = minimumAllowedDeliverTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

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

function OrderConfirmContext() {
    const { cooker } = useCooker();
    const { cart, clearCart } = useCart();
    const [showQR, setShowQR] = useState(false);
    const [slipPreview, setSlipPreview] = useState<string | null>(null);
    const [paidAt, setPaidAt] = useState<Date | null>(null);
    const [expired, setExpired] = useState(false);
    const router = useRouter();

    const {
        watch,
        control,
        handleSubmit,
        register,
        setValue,
        formState: { errors, isSubmitting, isValid, isDirty }
    } = useForm({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            paymentSlipImg: '',
            deliverAt: getBufferTime(),
            userTel: '',
        },
        mode: "onChange",
    });

    useEffect(() => {
        if (cooker?.restaurantId) {
            setValue("restaurantId", cooker.restaurantId);
        }
    }, [cooker, setValue]);

    useEffect(() => {
        return () => {
            if (slipPreview) URL.revokeObjectURL(slipPreview);
        };
    }, [slipPreview]);

    const totalAmount = useMemo(() => {
        if (!cart) return 0;

        return cart.reduce((total, item) => {
            return total + item.unitPrice * item.quantity;
        }, 0);
    }, [cart]);
    const formattedTotal = totalAmount.toFixed(2);

    if (!cooker) {
        toastDanger("ไม่พบข้อมูลร้านอาหาร");
        return;
    }

    const paymentQrImageUrl = cooker.paymentQr
    const paymentSlipImg = watch("paymentSlipImg");
    let isButtonDisabled = isSubmitting || !isValid || !isDirty || expired || cart.length === 0;

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

            setPaidAt(new Date());
            setExpired(false);
        };

        reader.onerror = () => {
            toastDanger("เกิดข้อผิดพลาดในการอ่านไฟล์");
        };

        reader.readAsDataURL(file);
    };

    const submitOrder = async (data: CreateOrderSchemaType) => {
        try {
            if (!cart || cart.length === 0) {
                toastDanger('ตะกร้าสินค้าว่างเปล่า กรุณาเพิ่มรายการอาหาร');
                return;
            }

            if (!paymentSlipImg) {
                toastDanger("กรุณาอัพโหลดสลิปก่อนสั่งอาหาร");
                return;
            }

            if (!cooker) {
                toastDanger("ไม่พบข้อมูลร้านอาหาร");
                return;
            }

            const orderPaymentPayload: orderPaymentPayload = {
                paymentSlipImg: paymentSlipImg,
                restaurantId: cooker.restaurantId,
                paidAt: paidAt ?? new Date(),
                deliverAt: new Date(data.deliverAt),
                orderMenus: cart.map((item) => ({
                    menuId: item.menuId,
                    menuName: item.menuName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    menuImg: item.menuImg,
                })),
                userTel: data.userTel,
            }

            isButtonDisabled = true;

            const response = await api.post(`/order/verify-and-create-order`, orderPaymentPayload);
            const result = response.data;
            localStorage.setItem(`orderSecret:${result.orderId}`, result.orderSecret);
            clearCart()


            toastSuccess("ชำระเงินสำเร็จและสร้างออเดอร์เรียบร้อย");
            router.push(`/user/order/done/${result.orderId}`);

        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };

                const backendMessage = err.response.data?.message;
                const code = err.response?.data?.code;

                toastDanger(code ? slipErrorMap[code] ?? backendMessage ?? "เกิดข้อผิดพลาด" : backendMessage ?? "เกิดข้อผิดพลาด");
            }
        }
    }

    return (
        <form
            className="flex flex-col h-screen gap-y-10 py-10 px-6"
            onSubmit={handleSubmit(submitOrder)}
        >
            <h3
                className="flex w-full justify-center font-noto-thai text-bold text-primary text-2xl"
            >
                {cooker.name}
            </h3>

            <div className="flex flex-col justify-between gap-y-6">
                <div className="flex justify-between items-center">
                    <p className="text-lg text-primary font-noto-thai text-bold">สรุปออเดอร์</p>
                    {/* <button onClick={handleCalculateTimeClick}>
                        <p className="text-info text-xs  underline">คำนวณเวลาได้รับอาหาร?</p>
                    </button> */}
                </div>
                <OrderList items={cart} />
            </div>

            <div className="flex w-[calc(100%+3rem)] justify-between bg-primary-main text-white p-6 -mx-6">
                <h3 className="font-noto-thai text-bold text-2xl">ยอดรวมทั้งหมด</h3>
                <h3 className="font-noto-thai text-bold text-2xl">{formattedTotal}</h3>
            </div>

            <Input
                type="tel"
                label="เบอร์ติดต่อ"
                placeholder="0xxxxxxxxx"
                {...register('userTel')}
                // name="userTel"
                error={errors.userTel?.message}
            />

            <div className="flex flex-col gap-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-noto-thai text-bold ">เลือกเวลารับอาหาร</h3>
                    <p className="font-noto-thai text-sm text-danger-main">
                        ใช้เวลาจัดเตรียมขั้นต่ำ 5 นาที
                    </p>
                </div>
                <div>
                    <Controller
                        name="deliverAt"
                        control={control}
                        render={({ field }) => (
                            <TimePickerInput
                                {...field}
                            />
                        )}
                    />
                    {errors.deliverAt && (
                        <p className="text-red-500 text-sm z-50">
                            กรุณาเลือกเวลาจัดส่งหลังเวลาปัจจุบันอย่างน้อย 5 นาที
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-y-6">
                <div className="flex flex-col w-full justify-center items-center gap-y-6">
                    {showQR && (
                        <>
                            <Image
                                src={paymentQrImageUrl}
                                alt="Payment QR picture"
                                width={300}
                                height={300}
                                className="object-cover aspect-square rounded-lg"
                            />
                        </>
                    )}

                    <CountdownTimer duration={300} onExpire={() => setExpired(true)} />

                    <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        onClick={() => setShowQR(prev => !prev)}
                    >
                        {showQR ? "Hide Payment QR" : "Show Payment QR"}
                    </Button>
                </div>
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

            <div className=" w-full px-6 z-50 flex">
                <Button
                    className="w-full font-noto-thai text-bold py-4"
                    type="submit"
                    // disable when user doesn't complete the form
                    disabled={isButtonDisabled}
                >
                    {isSubmitting ? "กำลังส่งคำสั่งซื้อ..." : "ยืนยันออเดอร์พร้อมชำระเงิน"}
                </Button>
            </div>
        </form>
    );
}

export default function OrderConfirmPage() {

    return (
        <OrderConfirmContext />
    );
}
