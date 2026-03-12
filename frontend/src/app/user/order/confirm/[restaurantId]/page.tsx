"use client";

import { useCart } from '@/context/CartContext';
import { MenuProvider, useMenu } from '@/context/MenuContext';
import OrderList, { OrderMenuType } from '@/components/users/OrderList';
import TimePickerInput from '@/components/ui/TimePicker';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { api, slipApi } from '@/lib/api';
import { useForm, Controller } from 'react-hook-form';
import { createOrderSchema, CreateOrderSchemaType } from '@/schemas/addOrderSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toastDanger } from '@/components/ui/Toast';
import Image from 'next/image';
import { PandaIcon } from 'lucide-react';
import { toastSuccess } from '@/components/ui/Toast';

interface orderPaymentPayload {
    paymentSlipImg: string;
    totalAmount: number;
    restaurantId: string;
    deliverAt: Date;
    userTel: string;
    orderMenus: OrderMenuType[];
}

// Fixed 5-minute buffer at all times
const getRequiredBufferMinutes = (): number => 5;
const paymentQrImageUrl = "/picture.svg"

const getBufferTime = (): string => {
    const now = new Date();
    const bufferMins = getRequiredBufferMinutes() + 1;
    const minimumAllowedDeliverTime = new Date(now.getTime() + bufferMins * 60 * 1000);
    const hours = minimumAllowedDeliverTime.getHours().toString().padStart(2, '0');
    const minutes = minimumAllowedDeliverTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

function OrderConfirmContext() {
    const { restaurant } = useMenu();
    const { cart } = useCart();
    // const router = useRouter();
    // const [click, setClick] = useState<number>(0);
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
            restaurantId: restaurant?.restaurantId,
            userTel: '',
        },
        mode: "onChange",
    });

    const paymentSlipImg = watch("paymentSlipImg");
    const totalAmount = cart.reduce((total, value) => { return total + value.totalPrice }, 0)
    const isButtonDisabled = isSubmitting || !isValid || !isDirty || cart.length === 0;

    const handleSlipUpload = (file: File) => {
        const reader = new FileReader();

        if (file.size > 2 * 1024 * 1024) {
            toastDanger("ไฟล์สลิปต้องไม่เกิน 2MB");
            return;
        }

        reader.onloadend = () => {
            setValue("paymentSlipImg", reader.result as string, {
                shouldValidate: true,
                shouldDirty: true,
            });
        };

        reader.readAsDataURL(file)
    }

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

            if (!restaurant) {
                toastDanger("ไม่พบข้อมูลร้านอาหาร");
                return;
            }

            const orderPaymentPayload: orderPaymentPayload = {
                paymentSlipImg: paymentSlipImg,
                restaurantId: restaurant.restaurantId,
                totalAmount: totalAmount,
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

            const now = new Date();
            const deliverAtDate = new Date(orderPaymentPayload.deliverAt);
            const bufferMins = getRequiredBufferMinutes();

            const diffMs = deliverAtDate.getTime() - now.getTime();
            const diffMinutes = Math.floor(diffMs / (60 * 1000));

            const response = await api.post(`/order/verify-and-create-order`, orderPaymentPayload);
            toastSuccess("ชำระเงินสำเร็จและสร้างออเดอร์เรียบร้อย");
            console.log('Response data: ', response.data);
            // alert('กำลังนำทางไปหน้าชำระเงิน ห้ามรีเฟรชหรือปิดหน้าQR Code');
            // const { checkoutUrl } = response.data;
            // router.push(checkoutUrl);

        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string } } };

                toastDanger(err.response.data?.message ?? "เกิดข้อผิดพลาด");
            }
        }
    }

    return (
        <form
            className="flex flex-col h-screen gap-y-10 py-10 px-6"
            onSubmit={handleSubmit(submitOrder)}
        >
            <h3
                className="flex w-full justify-center noto-sans-bold text-primary text-2xl"
            >
                {restaurant?.name}
            </h3>

            <div className="flex flex-col justify-between gap-y-6">
                <div className="flex justify-between items-center">
                    <p className="text-lg text-primary noto-sans-bold">สรุปออเดอร์</p>
                    {/* <button onClick={handleCalculateTimeClick}>
                        <p className="text-info text-xs  underline">คำนวณเวลาได้รับอาหาร?</p>
                    </button> */}
                </div>
                <OrderList items={cart} />
            </div>

            <div className="flex w-[calc(100%+3rem)] justify-between bg-primary-main text-white p-6 -mx-6">
                <h3 className="noto-sans-bold text-xl">ทั้งหมด</h3>
                <h3 className="noto-sans-bold text-xl">{totalAmount}</h3>
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
                    <h3 className="noto-sans-bold text-base">เลือกเวลารับอาหาร</h3>
                    <p className="noto-sans-regular text-sm text-danger-main">
                        ใช้เวลาจัดเตรียมขั้นต่ำ 5 นาที
                    </p>
                </div>
                <div>
                    <Controller
                        name="deliverAt"
                        control={control}
                        render={({ field }) => (
                            <TimePickerInput
                                {...field} // This correctly passes value, onChange, name, onBlur
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
                <h3 className="noto-sans-bold text-start text-primary text-base">ชำระเงินจากQRนี้</h3>

                <div className="flex w-full justify-center">
                    <Image
                        src={paymentQrImageUrl}
                        alt="Payment QR picture"
                        width={300}
                        height={300}
                    />
                </div>
            </div>

            <Input
                type="file"
                variant={paymentSlipImg ? "success" : "primary"}
                label={paymentSlipImg ? "อัพโหลดสลิปสำเร็จ" : "ยังไม่ได้อัพโหลดสลิป"}
                placeholder="อัพโหลดสลิปชำระเงิน"
                id="paymentSlipImg"
                accept="image/*,.svg,.svg+xml"
                multiple={false}
                error={errors.paymentSlipImg?.message as string | undefined}
                {...register('paymentSlipImg')}
                onChange={(e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleSlipUpload(file);
                }}
            />

            <div className=" w-full px-6 z-50 flex">
                <Button
                    className="w-full noto-sans-bold py-4"
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
        <MenuProvider>
            <OrderConfirmContext />
        </MenuProvider>
    );
}
