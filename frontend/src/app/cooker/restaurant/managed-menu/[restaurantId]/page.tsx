"use client";

import { useState, useCallback, useRef, useMemo } from 'react'
import CookerHeader from '@/components/cookers/CookerHeader'
import { Button } from '@/components/Button'
import { Menu as MenuComponent } from '@/components/cookers/Menu'
import { useParams, useRouter } from 'next/navigation';
import Input from '@/components/Input';
import { useDeleteMenu, useToggleMenuAvailability, useMenus } from '@/hook/useMenu';
import { toastDanger } from '@/components/ui/Toast';
import { useCooker } from '@/hook/useCooker';

function Page() {
    const params = useParams();
    const restaurantId = params.restaurantId as string;
    const { data: cooker } = useCooker(restaurantId);
    const [, setError] = useState<string | null>(null);
    const [, setPatchingMenuId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const currentRequestRef = useRef<number | null>(null);
    const router = useRouter();

    const { data: menus = [] } = useMenus(restaurantId);
    const { mutate: toggleAvailability } = useToggleMenuAvailability(restaurantId);
    const { mutate: deleteMenu } = useDeleteMenu(restaurantId);

    const filteredMenus = useMemo(() => {
        if (!menus) return [];

        const query = searchQuery.trim().toLowerCase();

        return menus.filter(menu => {
            if (!query) return true;
            return menu.name.toLowerCase().includes(query);
        });
    }, [menus, searchQuery]);

    const handleMenuAvailabilityChange = useCallback(
        (menuId: string, newIsAvailable: boolean) => {
            toggleAvailability(
                { menuId, isAvailable: newIsAvailable },
                { onError: () => toastDanger("อัปเดตสถานะเมนูล้มเหลว กรุณาลองใหม่อีกครั้ง") }
            );
        },
        [toggleAvailability]
    );

    const handleDeleteMenu = useCallback(
        (menuId: string) => {
            deleteMenu(menuId, {
                onError: () => toastDanger("ลบเมนูล้มเหลว กรุณาลองใหม่อีกครั้ง"),
            });
        },
        [deleteMenu]
    );

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
