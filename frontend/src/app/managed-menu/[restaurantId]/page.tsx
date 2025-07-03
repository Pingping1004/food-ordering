"use client";

import React from 'react'
import CookerHeader from '@/components/cookers/Header'
import { Button } from '@/components/Button'
import { Menu } from '@/components/cookers/Menu'
import { useMenu, MenuProvider } from '@/context/MenuContext';
import { useRouter } from 'next/navigation';

function Page() {
  const { restaurant, menus } = useMenu();
  console.log('RestaurantId: ', restaurant.restaurantId);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <CookerHeader
        restaurantId={restaurant.restaurantId}
        name={restaurant.name}
        email={restaurant.email}
        openTime={restaurant.openTime}
        closeTime={restaurant.closeTime}
      />

      <Button
        type="button"
        size="full"
        onClick={() => router.push(`/add-menu/${restaurant.restaurantId}`)}
      >
        <p>เพิ่มรายการอาหาร</p>
      </Button>

      <h2 className="noto-sans-bold text-lg">จัดการเมนู</h2>
      {menus?.map((menu) => (
        <Menu
          key={menu.menuId}
          menuId={menu.menuId}
          name={menu.name}
          price={menu.price}
          maxDaily={menu.maxDaily}
          cookingTime={menu.cookingTime}
          createdAt={menu.createdAt}
          isAvailable={menu.isAvailable}
        />
      ))}

    </div>
  )
}

export default function ManageMenuPage() {
  return (
    <MenuProvider>
      <Page />
    </MenuProvider>
  )
}
