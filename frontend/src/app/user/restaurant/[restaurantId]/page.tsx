"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '@/context/CartContext';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { toastDanger } from '@/components/ui/Toast';
import Input from '@/components/Input';
import { useMenus } from '@/hook/useMenu';
import LoadingPage from '@/components/LoadingPage';
import { useCooker } from '@/hook/useCooker';
import { api } from '@/lib/api';

const MenuProfile = dynamic(() => import("../../../../components/users/MenuProfile"), { ssr: false })
const RestaurantHeader = dynamic(() => import("@/components/users/RestaurantHeader"))

function MenuContextPage() {
    const params = useParams();
    const restaurantId = (params.restaurantId) as string;
    const { data: cooker } = useCooker(restaurantId);
    const { cart } = useCart();
    const router = useRouter();
    const alertShownRef = useRef(false);
    const [isNowOpen, setIsNowOpen] = useState<boolean>(true);
    const [orderAmount, setOrderAmount] = useState<number>(0);
    const [searchQuery, setSearchQuery] = useState("");

    const { data, isLoading } = useMenus(restaurantId);
    const menus = useMemo(() => (data ?? []), [data]);

    const checkOrderCart = () => {
        if (!cooker) {
            toastDanger("ไม่พบข้อมูลร้าน");
            return;
        }

        router.push(`/user/order/confirm/${cooker?.restaurantId}`);
    }

    useEffect(() => {
        if (!cooker) return;

        if (!cooker.isActuallyOpen && !alertShownRef.current) {
            toastDanger(`ขณะนี้ร้าน ${cooker.name}ยังไม่เปิดให้บริการ`);
            alertShownRef.current = true;
            setIsNowOpen(false);
        }

        const fetchOrderAmnout = async (): Promise<void> => {
            const orderResponse = await api.get(`order/active-count/${cooker?.restaurantId}`);
            const data = orderResponse.data;
    
            setOrderAmount(data.activeOrderCount);
        }
    
        fetchOrderAmnout();
    }, [cooker]);

    const filteredMenus = useMemo(() => {
        if (!menus) return [];

        const query = searchQuery.trim().toLowerCase();

        return menus.filter(menu => {
            if (!menu.isOrderable) return false;
            if (!query) return true;

            return menu.name.toLowerCase().includes(query);
        });
    }, [menus, searchQuery]);

    if (isLoading) return <LoadingPage />

    return (
        <div className="relative min-h-screen pb-10">
            <div className="flex flex-col gap-y-10 py-10 px-6">
                {cooker && (
                    <RestaurantHeader
                        orderAmount={orderAmount}
                        restaurantId={cooker?.restaurantId}
                        name={cooker?.name}
                        restaurantImg={cooker?.restaurantImg}
                        openTime={cooker?.openTime}
                        closeTime={cooker?.closeTime}
                        adminTel={cooker?.adminTel}
                    />
                )}

                <h3 className="font-noto-thai text-bold  text-primary">เมนูสำหรับคุณ</h3>

                <Input
                    type="text"
                    name="menuSearchQuery"
                    placeholder="ค้นหาเมนู..."
                    value={searchQuery || ""}
                    onChange={(e => setSearchQuery(e.target.value))}
                    className="w-full px-4 py-2 border rounded-lg"
                />

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
                    {filteredMenus.map((menu, i) => (
                        <MenuProfile
                            key={menu.menuId}
                            menuId={menu.menuId}
                            menuImg={menu.menuImg}
                            name={menu.name}
                            sellPriceDisplay={menu.sellPriceDisplay}
                            // maxDaily={menu.maxDaily}
                            // cookingTime={menu.cookingTime}
                            isAvailable={menu.isAvailable}
                            restaurantId={menu.restaurantId}
                            isPriority={i === 0}
                            variant={(menu.isAvailable && isNowOpen) ? "on" : "off"}

                        />
                    ))}

                    {filteredMenus.length === 0 && (
                        <p className="text-center text-gray-500">ไม่พบเมนูที่ค้นหา</p>
                    )}
                </div>

                {cart.length > 0 && (
                    <Button
                        type="button"
                        size="full"
                        numberIcon={cart.length}
                        iconPosition="start"
                        className=""
                        onClick={() => checkOrderCart()}
                    >
                        เช็คออเดอร์ของคุณ
                    </Button>
                )}
            </div>
        </div>
    )
}

export default function UserMenuPage() {
    return (
        <MenuContextPage />
    );
}
