"use client";

import React from 'react'
import { useCart } from '@/context/CartContext';
import { MenuProvider, useMenu } from '@/context/MenuContext';
import OrderList from '@/components/users/OrderList';
import { TimePickerInput } from '@/components/ui/TimePicker';
import { Button } from '@/components/Button';

function OrderConfirmContext() {
  const { restaurant } = useMenu();
  const { cart, addToCart, removeFromCart } = useCart();

  console.log(restaurant);
  console.log('Cart context: ', cart);

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <h3
        className="flex w-full justify-center noto-sans-bold text-primary text-2xl"
      >
        {restaurant?.name}
      </h3>

      <div className="flex flex-col justify-between gap-y-6">
        <div className="flex justify-between">
          <p className="text-base text-primary noto-sans-bold">สรุปออเดอร์</p>
          <p className="text-info text-sm  underline">คำนวณเวลาได้รับอาหาร?</p>
        </div>
        <OrderList
          items={cart}
        />
      </div>

      <div className="flex w-[calc(100%+3rem)] justify-between bg-primary-main text-white p-6 -mx-6">
        <h3 className="noto-sans-bold text-xl">ราคารวม</h3>
        <h3 className="noto-sans-bold text-xl">{cart.reduce((total, value) => { return total + value.totalPrice }, 0)}</h3>
      </div>

      <h3 className="text-primary noto-sans-bold text-base">ชำระเงิน</h3>
      <TimePickerInput />
      <Button
        type="button"
        variant="secondary"
      >
        ชำระเงิน
      </Button>
    </div>
  );
}

export default function OrderConfirmPage() {

  return (
    <MenuProvider>
      <OrderConfirmContext />
    </MenuProvider>
  );
}
