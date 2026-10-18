"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '@/context/CartContext';
import { useParams, useRouter } from 'next/navigation';
import { toastDanger } from '@/components/ui/Toast';
import { useMenus } from '@/hook/useMenu';
import { RestaurantDetailSkeleton } from '@/components/ui/Skeleton';
import { useCooker } from '@/hook/useCooker';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { isMenuOrderable, sellPriceOf } from '@/lib/types/menu';
import { todayHours } from '@/lib/schema/format';

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
    const [searchQuery, setSearchQuery] = useState("");

    // Queue length shown in the header. Was refetched on every `cooker` re-render and failed silently; now one cached,
    // periodically refreshed request per shop.
    const { data: orderAmount = 0 } = useQuery({
        queryKey: ["active-count", restaurantId],
        enabled: !!cooker,
        staleTime: 10_000,
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
        queryFn: async () => (await api.get<{ activeOrderCount: number }>(`order/active-count/${restaurantId}`)).data.activeOrderCount,
    });

    const { data, isLoading } = useMenus(restaurantId);
    const menus = useMemo(() => (data ?? []), [data]);

    const checkOrderCart = () => {
        if (!cooker) {
            toastDanger("ไม่พบข้อมูลร้าน", "ร้านอาจปิดหรือถูกลบไปแล้ว กรุณาเลือกร้านอื่น");
            return;
        }

        router.push(`/user/order/confirm/${cooker?.restaurantId}`);
    }

    useEffect(() => {
        if (!cooker) return;

        if (!cooker.isActuallyOpen && !alertShownRef.current) {
            toastDanger(`ขณะนี้ร้าน ${cooker.name} ยังไม่เปิดให้บริการ`, "กรุณากลับมาสั่งใหม่ในเวลาเปิดร้าน");
            alertShownRef.current = true;
            setIsNowOpen(false);
        }
    }, [cooker]);

    const filteredMenus = useMemo(() => {
        if (!menus) return [];

        const query = searchQuery.trim().toLowerCase();

        return menus.filter(menu => {
            if (!isMenuOrderable(menu)) return false;
            if (!query) return true;

            return menu.name.toLowerCase().includes(query);
        });
    }, [menus, searchQuery]);

    if (isLoading) return <RestaurantDetailSkeleton />;

    const cartCount = cart.reduce((n, i) => n + i.quantity, 0);
    const cartTotal = cart.reduce((n, i) => n + i.quantity * i.unitPrice, 0);

    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] md:max-w-3xl lg:max-w-6xl flex-col bg-ground font-app text-brand-dark">
            {cooker && (
                <RestaurantHeader
                    orderAmount={orderAmount}
                    restaurantId={cooker?.restaurantId}
                    name={cooker?.name}
                    restaurantImg={cooker?.restaurantImg ?? cooker?.profile}
                    openTime={cooker?.openTime ?? todayHours(cooker?.operatingHours)?.open}
                    closeTime={cooker?.closeTime ?? todayHours(cooker?.operatingHours)?.close}
                    adminTel={cooker?.contactTel ?? cooker?.adminTel}
                />
            )}

            <main className="flex flex-1 flex-col gap-3.5 px-4 pb-28 pt-4">
                <label className="flex h-12 items-center gap-2.5 rounded-xl border border-line-soft bg-white px-3.5 text-brand-muted">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                    <input
                        type="search"
                        aria-label="ค้นหาเมนู"
                        placeholder="ค้นหาเมนู"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-base text-brand-dark outline-none"
                    />
                </label>

                <h2 className="mt-1 text-lg font-bold">เมนูทั้งหมด</h2>

                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredMenus.map((menu, i) => (
                        <MenuProfile
                            key={menu.menuId}
                            menuId={menu.menuId}
                            menuImg={menu.menuImg}
                            name={menu.name}
                            sellPriceDisplay={sellPriceOf(menu)}
                            isAvailable={menu.isAvailable}
                            restaurantId={menu.restaurantId}
                            isPriority={i === 0}
                            variant={(menu.isAvailable && isNowOpen) ? "on" : "off"}
                        />
                    ))}
                </ul>
                {filteredMenus.length === 0 && (
                    <p className="py-10 text-center text-brand-muted">ไม่พบเมนูที่ค้นหา</p>
                )}
            </main>

            {cart.length > 0 && (
                <div className="fixed bottom-0 left-[var(--sidebar-w)] right-0 z-20 mx-auto max-w-[640px] bg-gradient-to-t from-ground from-30% to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:max-w-3xl lg:max-w-6xl">
                    <button
                        type="button"
                        onClick={() => checkOrderCart()}
                        className="flex h-[60px] w-full items-center justify-between rounded-2xl bg-primary-main px-5 text-[17px] font-bold text-white"
                    >
                        <span className="flex items-center gap-2.5">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1 text-[15px] text-black">{cartCount}</span>
                            ดูตะกร้า
                        </span>
                        <span>{cartTotal} บาท</span>
                    </button>
                </div>
            )}
        </div>
    )
}

export default function UserMenuPage() {
    return (
        <MenuContextPage />
    );
}
