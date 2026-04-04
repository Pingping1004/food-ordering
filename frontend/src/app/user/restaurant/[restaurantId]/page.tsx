"use client";

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react'
import { useMenu } from '@/context/MenuContext'
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { toastDanger } from '@/components/ui/Toast';
import { useCooker } from '@/context/Cookercontext';

const MenuProfile = dynamic(() => import("../../../../components/users/MenuProfile"), { ssr: false })
const RestaurantHeader = dynamic(() => import("@/components/users/RestaurantHeader"))

function MenuContextPage() {
    const { menus } = useMenu();
    const { cooker } = useCooker();
    const { cart } = useCart();
    const router = useRouter();
    const alertShownRef = useRef(false);
    const [isNowOpen, setIsNowOpen] = useState<boolean>(true);

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
    }, [cooker]);

    return (
        <div className="relative min-h-screen pb-10">
            <div className="flex flex-col gap-y-10 py-10 px-6">
            <RestaurantHeader
                restaurantId={cooker?.restaurantId ?? ""}
                name={cooker?.name ?? ""}
                restaurantImg={cooker?.restaurantImg ?? ""}
                openTime={cooker?.openTime ?? ""}
                closeTime={cooker?.closeTime ?? ""}
                adminTel={cooker?.adminTel ?? ""}
            />

            <h3 className="font-noto-thai text-bold  text-primary">เมนูสำหรับคุณ</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
                {menus?.filter(menu => menu.isOrderable === true).map((menu, i) => (
                    <MenuProfile
                        key={menu.menuId}
                        menuId={menu.menuId}
                        menuImg={menu.menuImg}
                        name={menu.name}
                        // unitPrice={menu.price}
                        sellPriceDisplay={menu.sellPriceDisplay}
                        // maxDaily={menu.maxDaily}
                        // cookingTime={menu.cookingTime}
                        // isAvailable={menu.isAvailable}
                        restaurantId={menu.restaurantId}
                        isPriority={i === 0}
                        variant={(menu.isAvailable && isNowOpen) ? "on" : "off"}

                    />
                ))}
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
