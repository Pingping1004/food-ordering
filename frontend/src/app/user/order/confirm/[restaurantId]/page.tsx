"use client";

import React from 'react'
import { useCart } from '@/context/CartContext';
import { MenuProvider, useMenu } from '@/context/MenuContext';
import OrderList from '@/components/users/OrderList';
import { TimePickerInput } from '@/components/ui/TimePicker';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

function OrderConfirmContext() {
  const { restaurant } = useMenu();
  const { cart, addToCart, removeFromCart } = useCart();

  console.log(restaurant);
  console.log('Cart context: ', cart);

  return (
    <form className="flex flex-col h-screen gap-y-10 py-10 px-6">
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
        <OrderList
          items={cart}
        />
      </div>

      <div className="flex w-[calc(100%+3rem)] justify-between bg-primary-main text-white p-6 -mx-6">
        <h3 className="noto-sans-bold text-xl">ราคารวม</h3>
        <h3 className="noto-sans-bold text-xl">{cart.reduce((total, value) => { return total + value.totalPrice }, 0)}</h3>
      </div>

      <div className="flex flex-col gap-y-4">
        <h3 className="noto-sans-bold text-base">เลือกเวลารับอาหาร</h3>
        <TimePickerInput />
      </div>

      <div className="flex flex-col gap-y-4">
        <h3 className="noto-sans-bold text-primary text-base">ชำระเงินด้วยแอพธนาคาร</h3>
        <Input
          type="select"
          name="bank"
          label="เลือกธนาคารของคุณ"
          placeholder="เลือกธนาคารของคุณ"
          options={[
            { key: 'KBANK', value: 'kbank' },
            { key: 'SCB', value: 'scb' },
            { key: 'KRUNGSRI', value: 'krungsri' },
            { key: 'Bangkok bank', value: 'bbl' },
            { key: 'Krungthai bank', value: 'krungthai' },
          ]}
        />
      </div>

      <div className="fixed left-0 right-0 bottom-10 w-full px-6 z-50 flex">
        <Button 
          className="w-full noto-sans-bold"
          type="submit"
        >
          ยืนยันออเดอร์
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
