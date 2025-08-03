"use client";

import { useCart } from '@/context/CartContext';
import { MenuProvider, useMenu } from '@/context/MenuContext';
import OrderList from '@/components/users/OrderList';
import TimePickerInput from '@/components/ui/TimePicker';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { api } from '@/lib/api';
import { useForm, Controller } from 'react-hook-form';
import { createOrderSchema, CreateOrderSchemaType } from '@/schemas/addOrderSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toastDanger } from '@/components/ui/Toast';
// import { toast } from 'sonner';
// import { toastPrimary } from '@/components/ui/Toast';

const now = new Date();
const currentHour = new Date().getHours();

const getBufferTime = ({
    deliverHour = new Date().getHours(),
    bufferMins = 0,
}: {
    deliverHour?: number;
    bufferMins?: number;
} = {}): string => {
    const peakTimeBuffer = (currentHour === 12 || deliverHour === 12) ? 10 : 0;
    const timeBuffer = peakTimeBuffer + bufferMins;
    const minimumAllowedDeliverTime = new Date(now.getTime() + timeBuffer * 60 * 1000);
    const hours = minimumAllowedDeliverTime.getHours().toString().padStart(2, '0');
    const minutes = minimumAllowedDeliverTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

function OrderConfirmContext() {
    const { restaurant } = useMenu();
    const { cart } = useCart();
    const router = useRouter();
    // const [click, setClick] = useState<number>(0);
    const {
        control,
        handleSubmit,
        register,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            paymentMethod: 'promptpay',
            deliverAt: getBufferTime({ bufferMins: 10 }),
            restaurantId: restaurant?.restaurantId,
            userTel: '',
            userEmail: ''
        },
        mode: "onBlur",
    });

    // const handleCalculateTimeClick = () => {
    //     toastPrimary('ยังไม่เปิดใช้งานนะ แต่เดี๋ยวมาแน่นอน');
    //     setClick(prev => prev + 1);
    // }

    const submitOrder = async (data: CreateOrderSchemaType) => {
        try {

            const orderPayload = {
                restaurantId: restaurant?.restaurantId,
                orderMenus: cart.map((item) => ({
                    menuId: item.menuId,
                    menuName: item.menuName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    menuImg: item.menuImg,
                })),
                userTel: data.userTel,
                userEmail: data.userEmail,
                paymentMethod: data.paymentMethod,
                deliverAt: data.deliverAt?.toISOString(),
            };

            if (!cart || cart.length === 0) {
                toastDanger('ตะกร้าสินค้าว่างเปล่า กรุณาเพิ่มรายการอาหาร');
                return; // Prevent submission
            }

            const deliverHour = new Date(orderPayload.deliverAt).getHours();
            const timeBuffer = (deliverHour === 12 || currentHour === 12) ? 20 : 10;
            if (new Date(getBufferTime({ deliverHour, bufferMins: 10 })) > new Date(orderPayload.deliverAt)) {
                toastDanger(`เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย ${timeBuffer}นาที`);
                return;
            }

            const response = await api.post(`/order/create`, orderPayload);
            alert('กำลังนำทางไปหน้าชำระเงิน ห้ามรีเฟรชหรือปิดหน้าQR Code');
            const { checkoutUrl } = response.data;
            router.push(checkoutUrl);

        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string } } };

                toastDanger(err.response.data?.message as string);
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
                <h3 className="noto-sans-bold text-xl">{cart.reduce((total, value) => { return total + value.totalPrice }, 0)}</h3>
            </div>

            <div className="flex flex-col gap-y-4">
                <h2 className="noto-sans-bold text-primary text-base">ข้อมูลติดต่อ</h2>
                <div className="grid grid-cols-2 gap-x-6">
                    <Input
                        type="tel"
                        label="เบอร์ติดต่อ"
                        placeholder="0xxxxxxxxx"
                        {...register('userTel')}
                        // name="userTel"
                        error={errors.userTel?.message}
                    />

                    <Input
                        type="email"
                        label="อีเมลลูกค้า"
                        placeholder="example@gmail.com"
                        {...register('userEmail')}
                        // name="userTel"
                        error={errors.userEmail?.message}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="noto-sans-bold text-base">เลือกเวลารับอาหาร</h3>
                    <p className="noto-sans-regular text-sm text-danger-main">
                        ใช้เวลาจัดเตรียมขั้นต่ำ{(currentHour === 12) ? 20 : 10}นาที
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
                        <p className="text-red-500 text-sm z-50">กรุณาเลือกเวลาจัดส่งหลัง {getBufferTime({ bufferMins: 10 })}นาที</p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-y-4">
                <h3 className="noto-sans-bold text-primary text-base">ชำระเงิน</h3>
                <Controller
                    control={control}
                    name="paymentMethod"
                    render={({ field }) => (
                        <Input
                            type="select"
                            label="เลือกวิธีการชำระเงิน"
                            {...field}
                            options={[
                                { key: 'พร้อมเพย์', value: 'promptpay' },
                            ]}
                        />
                    )}
                />
                {errors.paymentMethod && <p className="text-red-500 text-base">{errors.paymentMethod.message}</p>}
            </div>

            <div className=" w-full px-6 z-50 flex">
                <Button
                    className="w-full noto-sans-bold py-4"
                    type="submit"
                    disabled={isSubmitting}
                >
                    ยืนยันออเดอร์พร้อมชำระเงิน
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
