"use client";

import React from 'react'
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

const NGROK_WEBSITE_URL = 'https://39e5-124-120-1-65.ngrok-free.app';


const now = new Date();

const getBufferTime = (bufferMins: number = 0): string => {
    const minimumAllowedDeliverTime = new Date(now.getTime() + bufferMins * 60 * 1000);
    const hours = minimumAllowedDeliverTime.getHours().toString().padStart(2, '0');
    const minutes = minimumAllowedDeliverTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

function OrderConfirmContext() {
    const { restaurant } = useMenu();
    const { cart } = useCart();
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            paymentMethod: 'promptpay',
            deliverAt: getBufferTime(6),
            restaurantId: restaurant?.restaurantId,
        },
        mode: "onBlur",
    });

    const onError = (formErrors: typeof errors) => {
        const messages = Object.entries(formErrors)
            .map(([field, error]) => `${field}: ${error?.message}`)
            .join('\n');

        alert(`กรุณากรอกข้อมูลให้ถูกต้อง:\n\n${messages}`);
    };

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
                paymentMethod: data.paymentMethod,
                deliverAt: data.deliverAt?.toISOString(),
            };

            if (!cart || cart.length === 0) {
                console.error('Validation Error: Cart is empty.');
                alert('ตะกร้าสินค้าว่างเปล่า กรุณาเพิ่มรายการอาหาร');
                return; // Prevent submission
            }

            if (new Date(getBufferTime(5)) > new Date(orderPayload.deliverAt)) {
                console.error('Deliver time must be after current time at least 5 mins');
                alert('เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย 5นาที');
                return;
            }

            const response = await api.post(`${NGROK_WEBSITE_URL}/order/omise`, orderPayload);
            alert(`สั่งอาหารออเดอร์: ${response.data.orderId}`)
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <form
            className="flex flex-col h-screen gap-y-10 py-10 px-6"
            onSubmit={handleSubmit(submitOrder, onError)}
        >
            <h3
                className="flex w-full justify-center noto-sans-bold text-primary text-2xl"
            >
                {restaurant?.name}
            </h3>

            <div className="flex flex-col justify-between gap-y-6">
                <div className="flex justify-between items-center">
                    <p className="text-lg text-primary noto-sans-bold">สรุปออเดอร์</p>
                    <p className="text-info text-xs  underline">คำนวณเวลาได้รับอาหาร?</p>
                </div>
                <OrderList items={cart} />
            </div>

            <div className="flex w-[calc(100%+3rem)] justify-between bg-primary-main text-white p-6 -mx-6">
                <h3 className="noto-sans-bold text-xl">ทั้งหมด</h3>
                <h3 className="noto-sans-bold text-xl">{cart.reduce((total, value) => { return total + value.totalPrice }, 0)}</h3>
            </div>

            <div className="flex flex-col gap-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="noto-sans-bold text-base">เลือกเวลารับอาหาร</h3>
                    <p className="noto-sans-regular text-sm text-danger-main">
            ใช้เวลาจัดเตรียมขั้นต่ำ5นาที
                    </p>
                </div>
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
                    <p className="text-red-500 text-sm z-50">{errors.deliverAt.message}</p>
                )}
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
                {errors.paymentMethod && <p className="text-red-500 text-sm">{errors.paymentMethod.message}</p>}
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
