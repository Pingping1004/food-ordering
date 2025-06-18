"use client";

import React, { useEffect } from 'react'
import { MenuProvider, useMenuContext } from '@/context/MenuContext'
import { useCart } from '@/context/CartContext';
import RestaurantHeader from '@/components/users/RestaurantHeader';
import MenuProfile from '@/components/users/MenuProfile';
import { Button } from '@/components/Button';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function MenuContext() {
  const { restaurant, menus } = useMenuContext();
  const { cart } = useCart();
  const router = useRouter();
  console.log('Fetched menus: ', menus);
  console.log('Cart: ', cart);

  useEffect(() => {
    console.log('Cart changed:', cart);
  }, [cart]);

  const checkOrderCart = () => {
    router.push(`/user/order/confirm`);
  }

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <RestaurantHeader
        restaurantId={restaurant?.restaurantId ?? ""}
        name={restaurant?.name ?? ""}
        restaurantImg={restaurant?.restaurantImg ?? ""}
        openTime={restaurant?.openTime ?? ""}
        closeTime={restaurant?.closeTime ?? ""}
      />

      <h3 className="noto-sans-bold text-base text-primary">เมนูวันนี้</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
        {menus?.map((menu, index) => (
          <MenuProfile
            key={menu.menuId}
            menuId={menu.menuId}
            menuImg={menu.menuImg}
            name={menu.name}
            unitPrice={menu.price}
            maxDaily={menu.maxDaily}
            cookingTime={menu.cookingTime}
            isAvailable={menu.isAvailable}
            restaurantId={menu.restaurantId}

          />
        ))}
      </div>

      <Button
        type="button"
        size="full"
        numberIcon={cart.length}
        iconPosition="start"
        className="absolute bottom-10"
        onClick={() => checkOrderCart()}
      >
        เช็คออเดอร์ของคุณ
      </Button>
    </div>
  )
}

export default function UserMenuPage() {
  return (
    <MenuProvider>
      <MenuContext />
    </MenuProvider>
  );
}
