"use client";

import React, { useState, useCallback } from 'react'
import CookerHeader from '@/components/cookers/Header'
import { Button } from '@/components/Button'
import { Menu } from '@/components/cookers/Menu'
import { useMenu, MenuProvider, Menu as MenuType } from '@/context/MenuContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function Page() {
    const { restaurant, menus, setMenus } = useMenu();
    const [, setError] = useState<string | null>(null);
    const [, setPatchingMenuId] = useState<string | null>(null);
    const router = useRouter();

    const handleMenuAvailabilityChange = useCallback(async (menuId: string, newIsAvailable: boolean) => {
        if (!menus) return;

        const targetMenu = menus.find(menu => menu.menuId === menuId);
        if (!targetMenu) return;

        const prevIsAvailableStatus = targetMenu.isAvailable;
        setPatchingMenuId(menuId);
        setMenus(prevMenus => {
            if (!prevMenus) return [];
            return prevMenus.map(menu => {
                if (menu.menuId === menuId) {
                    return { ...menu, isAvailable: newIsAvailable };
                }
                return menu;
            });
        });

        try {
            const payload = {
                restaurantId: restaurant.restaurantId,
                isAvailable: newIsAvailable,
            }
            const response = await api.patch(`menu/is-available/${menuId}`, payload);

            setMenus(prevMenus => {
                if (!prevMenus) return [];
                return prevMenus.map(menu => {
                    if (menu.menuId === menuId) {
                        const confirmedIsAvailable = typeof response.data.isAvailable === 'boolean'
                            ? response.data.isAvailable
                            : newIsAvailable;
                        return { ...menu, isAvailable: confirmedIsAvailable };
                    }
                    return menu;
                });
            });
        } catch {
            setMenus(prevMenus => {
                if (!prevMenus) return [];
                return prevMenus.map(menu => {
                    if (menu.menuId === menuId) {
                        return { ...menu, isAvailable: prevIsAvailableStatus };
                    }
                    return menu;
                })
            })
        } finally {
            setPatchingMenuId(null);
        }
    }, [menus, restaurant.restaurantId, setMenus]);

    const handleDeleteMenu = useCallback(async (menuIdToDelete: string) => {
        setError(null);

        let originalMenus: MenuType[] = [];

        setMenus((prevMenuLists) => {
            if (prevMenuLists === null) {
                originalMenus = [];
                return [];
            }
            originalMenus = prevMenuLists; // Store a copy of the current state
            return prevMenuLists.filter((menu) => menu.menuId !== menuIdToDelete);
        });

        try {
            await api.delete(`/menu/${menuIdToDelete}`);
        } catch {
            setMenus(originalMenus);
            setError(`Failed to delete menu ${menuIdToDelete}`);
        }
    }, [setMenus]); 

  return (
    <div className="flex flex-col gap-y-10 py-10 px-6">
      <CookerHeader
        restaurantId={restaurant.restaurantId}
        name={restaurant.name}
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
            {menus?.map((menu) => {
                return (
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
                        isAvailable={menu.isAvailable ?? false}
                        onAvailabilityChanged={handleMenuAvailabilityChange}
                        onDelete={handleDeleteMenu}
                    />
                )
            })}

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
