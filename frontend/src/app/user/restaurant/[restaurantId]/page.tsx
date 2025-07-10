"use client";

import React, { useEffect, useRef, useState } from 'react'
import { MenuProvider, useMenu } from '@/context/MenuContext'
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import RestaurantHeader from '@/components/users/RestaurantHeader';
import MenuProfile from '@/components/users/MenuProfile';
import { Button } from '@/components/Button';

function MenuContext() {
    const { restaurant, menus } = useMenu();
    const { cart } = useCart();
    const router = useRouter();
    const alertShownRef = useRef(false);
    const [isNowOpen, setIsNowOpen] = useState<boolean>(true);

    const checkOrderCart = () => {
        router.push(`/user/order/confirm/${restaurant?.restaurantId}`);
    }

    useEffect(() => {
        if (!restaurant.isActuallyOpen && !alertShownRef.current) {
            alert(`ขณะนี้ร้าน ${restaurant.name}ยังไม่เปิดให้บริการ`);
            alertShownRef.current = true;
            setIsNowOpen(false);
        }
    }, []);

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <RestaurantHeader
                restaurantId={restaurant?.restaurantId ?? ""}
                name={restaurant?.name ?? ""}
                restaurantImg={restaurant?.restaurantImg ?? ""}
                openTime={restaurant?.openTime ?? ""}
                closeTime={restaurant?.closeTime ?? ""}
            />

            <h3 className="noto-sans-bold text-base text-primary">เมนูสำหรับคุณ</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
                {menus?.map((menu) => (
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
                        variant={(menu.isAvailable && isNowOpen) ? "on" : "off"}

                    />
                ))}
            </div>

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
