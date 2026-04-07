"use client";

import { useState, useCallback, useRef, useMemo } from 'react'
import CookerHeader from '@/components/cookers/CookerHeader'
import { Button } from '@/components/Button'
import { Menu as MenuComponent } from '@/components/cookers/Menu'
import { useMenu } from '@/context/MenuContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCooker } from '@/context/Cookercontext';
import Input from '@/components/Input';

function Page() {
    const { menus, deleteMenuLocal, updateMenu } = useMenu();
    const { cooker } = useCooker();
    const restaurantId = cooker?.restaurantId;
    const [, setError] = useState<string | null>(null);
    const [, setPatchingMenuId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const currentRequestRef = useRef<number | null>(null);
    const router = useRouter();

    const filteredMenus = useMemo(() => {
        if (!menus) return [];

        const query = searchQuery.trim().toLowerCase();

        return menus.filter(menu => {
            if (!query) return true;
            return menu.name.toLowerCase().includes(query);
        });
    }, [menus, searchQuery]);

    const handleMenuAvailabilityChange = useCallback(async (menuId: string, newIsAvailable: boolean) => {
        if (!menus || !restaurantId) return;

        const targetMenu = menus.find(menu => menu.menuId === menuId);
        if (!targetMenu) return;

        const prev = targetMenu.isAvailable;
        setPatchingMenuId(menuId);

        updateMenu(menuId, (menu) => ({
            ...menu,
            isAvailable: newIsAvailable
        }));

        try {
            const payload = {
                restaurantId: restaurantId,
                isAvailable: newIsAvailable,
            }

            const requestId = Date.now();
            currentRequestRef.current = requestId;

            const res = await api.patch(`menu/is-available/${menuId}`, payload);

            if (currentRequestRef.current !== requestId) return;

            const confirmed = typeof res.data.isAvailable === "boolean" ? res.data.isAvailable : newIsAvailable;

            updateMenu(menuId, (menu) => ({
                ...menu,
                isAvailable: confirmed
            }));
        } catch {
            updateMenu(menuId, (menu) => ({
                ...menu,
                isAvailable: prev
            }));
        } finally {
            setPatchingMenuId(null);
        }
    }, [menus, restaurantId, updateMenu, setPatchingMenuId]);

    const handleDeleteMenu = useCallback(async (menuId: string) => {
        if (!menus) return;

        const backup = [...menus];
        deleteMenuLocal(menuId);

        try {
            await api.delete(`/menu/${menuId}`);
        } catch {
            backup.forEach(menu => updateMenu(menu.menuId, () => menu))
            setError(`Failed to delete menu ${menuId}`);
        }
    }, [menus, deleteMenuLocal, updateMenu]);

    if (!cooker) return null;

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <CookerHeader
                restaurantId={cooker.restaurantId}
                name={cooker.name}
                openTime={cooker.openTime}
                closeTime={cooker.closeTime}
            />

            <Input
                type="text"
                name="menuSearchQuery"
                placeholder="ค้นหาเมนู..."
                value={searchQuery || ""}
                onChange={(e => setSearchQuery(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg"
            />

            <Button
                type="button"
                size="full"
                onClick={() => router.push(`/cooker/restaurant/add-menu/${cooker.restaurantId}`)}
            >
                <p>เพิ่มรายการอาหาร</p>
            </Button>

            <h2 className="font-noto-thai font-bold text-lg">จัดการเมนู</h2>

            <div className="flex flex-col gap-y-6">
                {filteredMenus?.map((menu) => {
                    return (
                        <MenuComponent
                            restaurantid={cooker.restaurantId}
                            key={menu.menuId}
                            menuId={menu.menuId}
                            menuImg={menu.menuImg}
                            name={menu.name}
                            price={menu.price}
                            maxDaily={menu.maxDaily}
                            cookingTime={menu.cookingTime}
                            isAvailable={menu.isAvailable ?? false}
                            onAvailabilityChanged={handleMenuAvailabilityChange}
                            onDelete={handleDeleteMenu}
                        />
                    )
                })}

                {filteredMenus.length === 0 && (
                    <p className="text-center py-8 text-lg font-noto-thai text-gray-500">ไม่พบเมนูที่ค้นหา</p>
                )}
            </div>

        </div>
    )
}

export default function ManageMenuPage() {
    return (
        <Page />
    )
}
