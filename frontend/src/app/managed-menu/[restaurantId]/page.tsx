"use client";

import React, { useCallback } from 'react'
import CookerHeader from '@/components/cookers/Header'
import { Button } from '@/components/Button'
import { Menu } from '@/components/cookers/Menu'
import { useMenu, MenuProvider } from '@/context/MenuContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function Page() {
  const { restaurant, menus, setMenus } = useMenu();
  const router = useRouter();

  const handleMenuAvailabilityChange = useCallback(async (menuId: string, newIsAvailable: boolean) => {
  try {
    const payload = {
      restaurantId: restaurant.restaurantId,
      isAvailable: newIsAvailable,
    }
    console.log('Payload: ', payload);
    const response = await api.patch(`menu/is-available/${menuId}`, payload);
    console.log('Response: ', response.data);
    setMenus(prevMenus => {
      if (!prevMenus) return [];
      return prevMenus.map(menu => {
        if (menu.menuId === menuId) {
          return { ...menu, isAvailable: response.data.isAvailable };
        }
        return menu;
      });
    });
  } catch (err) {
    console.error("Failed to update availability", err);
  }
}, []);

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
          restaurantId={restaurant.restaurantId}
          key={menu.menuId}
          menuId={menu.menuId}
          menuImg={menu.menuImg}
          name={menu.name}
          price={menu.price}
          maxDaily={menu.maxDaily}
          cookingTime={menu.cookingTime}
          createdAt={menu.createdAt}
          isAvailable={menu.isAvailable}
          onAvailabilityChanged={handleMenuAvailabilityChange}
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
