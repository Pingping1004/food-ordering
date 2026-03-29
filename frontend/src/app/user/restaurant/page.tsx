"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import UserHeader from "@/components/users/UserHeader";
import type { Restaurant } from "@/app/data/type";
import { api } from "@/lib/api";
import RestaurantProfile from "../../../components/users/RestaurantProfile";
import useSWR from "swr";
import { Button } from "@/components/Button";

const Modal = dynamic(() => import("../../../components/users/Modal"), { ssr: false });

const fetcher = (url: string): Promise<Restaurant[]> =>
    api.get(url).then(res => res.data);

export default function UserHomePage() {
    const [showModal, setShowModal] = useState(() => {
        if (typeof window === "undefined") return false;
        return !localStorage.getItem("order-before-lunch-modal");
    });
    const [visibleCount, setVisibleCount] = useState(6);

    const { data: restaurants = [] } = useSWR<Restaurant[]>(
        "/restaurant",
        fetcher,
        {
            fallbackData: [],
            revalidateOnFocus: false,
            dedupingInterval: 60000,
            keepPreviousData: true,
        }
    );

    const visibleRestaurants = useMemo(
        () => restaurants.slice(0, visibleCount),
        [restaurants, visibleCount]
    );

    return (
        <>
            {showModal && (
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title="สั่งอาหารก่อน 11:45"
                    body="กรุณาสั่งอาหารก่อนเวลา 11:45 น. เพื่อให้ร้านอาหารสามารถเตรียมอาหารของคุณได้ทันเวลา"
                    confirmText="เข้าใจแล้ว"
                />
            )}

            <div className="flex flex-col gap-y-10 py-10 px-6">
                <UserHeader />
                <div className="grid md:grid-cols-4 lg:grid-cols-6 grid-cols-2 gap-x-4 gap-y-6">
                    {visibleRestaurants.map((restaurant, i) => (
                        <RestaurantProfile
                            key={restaurant.restaurantId}
                            name={restaurant.name}
                            categories={restaurant.categories}
                            restaurantId={restaurant.restaurantId}
                            restaurantImg={restaurant.restaurantImg}
                            isOpen={restaurant.isActuallyOpen}
                            isPriority={i < 4}
                            variant={restaurant.isActuallyOpen ? "isOpen" : "isClose"}
                        />
                    ))}
                </div>

                {visibleCount < restaurants.length && (
                    <Button
                        onClick={() => setVisibleCount(prev => prev + 12)}
                        type="button"
                        variant="secondary"
                    >
                        โหลดเพิ่ม
                    </Button>
                )}
            </div>
        </>
    );
}