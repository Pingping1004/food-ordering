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
import { useParams, useRouter } from 'next/navigation';
import { toastDanger } from '@/components/ui/Toast';
import { toastSuccess } from '@/components/ui/Toast';
import { useEffect, useMemo, useRef } from 'react';
import { useCooker } from '@/hook/useCooker';

const OrderList = dynamic(() => import("@/components/users/OrderList"), { ssr: false })
const Input = dynamic(() => import("@/components/Input"), { ssr: false })

export interface OrderPayload {
    restaurantId: string;
    deliverAt: Date;
    userTel: string;
    orderMenus: OrderMenuType[];
}

const ACCEPT_WINDOW_MINS = 3;
const PAYMENT_WINDOW_MINS = 3;
const SYSTEM_BUFFER_MINS = ACCEPT_WINDOW_MINS + PAYMENT_WINDOW_MINS;

const getBufferTime = (cookingTime: number): string => {
    const now = new Date();
    const totalMins = SYSTEM_BUFFER_MINS + cookingTime + 1;
    const minimumAllowedDeliverTime = new Date(now.getTime() + totalMins * 60 * 1000);
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
    const params = useParams();
    const restaurantId = params.restaurantId as string;

    const { data: cooker, isPending } = useCooker(restaurantId);
    const { cart, hydrated, clearCart } = useCart();
    const router = useRouter();

    const schema = useMemo(() => createOrderSchema(cooker?.avgCookingTime ?? 0), [cooker?.avgCookingTime]);

    const {
        control,
        handleSubmit,
        register,
        setValue,
        reset,
        formState: { errors, isSubmitting, isValid, isDirty, isLoading }
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            deliverAt: '',
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
        if (!cooker) {
            toastDanger("ไม่พบข้อมูลร้านอาหาร");
        }
    }, [cooker]);

    useEffect(() => {
        if (!cooker) return;

        reset({
            deliverAt: getBufferTime(cooker.avgCookingTime),
            userTel: '',
            restaurantId: cooker.restaurantId,
        });
    }, [cooker, reset]);

    useEffect(() => {
        const checkActiveOrder = async () => {
            const activeOrderId = localStorage.getItem('activeOrderId');
            if (!activeOrderId) return;
            
            const activeOrderSecret = localStorage.getItem(`orderSecret:${activeOrderId}`);
            if (!activeOrderSecret) {
                localStorage.removeItem('activeOrderId');
                return;
            }

            try {
                const res = await api.get(`/order/${activeOrderId}`, {
                    headers: { 'x-order-secret': activeOrderSecret }
                });
                
                const status = res.data.status;
                if (status === 'accepted') {
                    router.replace(`/user/order/payment/${activeOrderId}`);
                } else if (['sent', 'cooking', 'ready'].includes(status)) {
                    router.replace(`/user/order/wait/${activeOrderId}`);
                } else {
                    localStorage.removeItem('activeOrderId');
                }
            } catch (error) {
                localStorage.removeItem('activeOrderId');
            }
        };
        
        checkActiveOrder();
    }, [router]);

    const isSubmittedRef = useRef(false);

    useEffect(() => {
        if (hydrated && cart.length === 0 && !isSubmittedRef.current) {
            router.replace(`/user/restaurant`);
        }
    }, [hydrated, cart.length, router]);

    const totalAmount = useMemo(() => {
        if (!cart) return 0;

        return cart.reduce((total, item) => {
            return total + item.unitPrice * item.quantity;
        }, 0);
    }, [cart]);

    const formattedTotal = totalAmount.toFixed(2);
    const isButtonDisabled = isSubmitting || !isValid || !isDirty || isLoading || isPending || cart.length === 0;

    if (!cooker) return null;

    const submitOrder = async (data: CreateOrderSchemaType) => {
        try {
            if (!cart || cart.length === 0) {
                toastDanger('ตะกร้าสินค้าว่างเปล่า กรุณาเพิ่มรายการอาหาร');
                return;
            }

            const orderPaymentPayload: OrderPayload = {
                restaurantId: cooker.restaurantId,
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

            const response = await api.post(`/order/create`, orderPaymentPayload);
            const result = response.data;
            localStorage.setItem(`orderSecret:${result.orderId}`, result.orderSecret);
            localStorage.setItem(`activeOrderId`, result.orderId);

            isSubmittedRef.current = true;
            toastSuccess("สร้างออเดอร์เรียบร้อย");
            clearCart();
            
            if (result.status === 'accepted') {
                router.replace(`/user/order/payment/${result.orderId}`);
            } else {
                router.replace(`/user/order/wait/${result.orderId}`);
            }

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
                        <p className="text-info text-xs underline">คำนวณเวลาได้รับอาหาร?</p>
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
                    <p className="font-noto-thai text-base font-semibold text-danger-main">
                        รับอาหารได้หลัง {getBufferTime(cooker.avgCookingTime)}
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
                        <p className="text-red-500 font-noto-thai font-semibold text-base z-50">
                            กรุณาเลือกเวลาจัดส่งหลังเวลาปัจจุบันอย่างน้อย {6 + cooker.avgCookingTime} นาที
                        </p>
                    )}
                </div>
            </div>

            <div className=" w-full z-50 flex">
                <Button
                    className="w-full font-noto-thai text-bold py-4"
                    type="submit"
                    size="full"
                    disabled={isButtonDisabled}
                >
                    {isSubmitting ? "กำลังส่งคำสั่งซื้อ..." : "ส่งออเดอร์ไปยังร้าน"}
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
