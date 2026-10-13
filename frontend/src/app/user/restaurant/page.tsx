"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import UserHeader from "@/components/users/UserHeader";
import type { Restaurant } from "@/app/data/type";
import { api } from "@/lib/api";
import RestaurantProfile from "../../../components/users/RestaurantProfile";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import LoadingPage from "@/components/LoadingPage";

const Modal = dynamic(() => import("../../../components/users/Modal"), { ssr: false });

const fetchRestaurants = async (limit: number): Promise<Restaurant[]> => {
    const res = await api.get("/restaurant", {
        params: { limit },
    });

    return res.data;
};

export default function UserHomePage() {
    const [showModal, setShowModal] = useState(false);
    const [visibleCount, setVisibleCount] = useState(6);

    const {
        data: restaurants = [],
        isLoading,
        isError,
        refetch,
        isFetching,
    } = useQuery({
        queryKey: ["restaurants", { limit: visibleCount }],
        queryFn: () => fetchRestaurants(visibleCount),
    })

    useEffect(() => {
        const seen = localStorage.getItem("order-before-lunch-modal");
        if (!seen) setShowModal(true);
    }, []);

    if (isLoading) return <LoadingPage />
    if (isError) {
        return (
            <div className="text-center">
                <p>โหลดร้านอาหารไม่สำเร็จ</p>
                <Button
                    type="button"
                    variant="secondaryDanger"
                    onClick={() => refetch()}
                >
                    {isFetching ? "กำลังโหลด..." : "ลองใหม่"}
                </Button>
            </div>
        );
    }

    return (
        <>
            {showModal && (
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title="สั่งอาหารก่อน 11:45"
                    body="กรุณาสั่งอาหารก่อนเวลา 11:45 น. เพื่อให้ร้านอาหารสามารถเตรียมอาหารของคุณได้ทันเวลา"
                    confirmText="เข้าใจแล้ว"
                    onConfirm={() => {
                        localStorage.setItem("order-before-lunch-modal", "true");
                        setShowModal(false);
                    }}
                />
            )}

            <div className="flex flex-col gap-y-10 py-10 px-6">
                <UserHeader />

                {isFetching && !isLoading && (
                    <p className="text-sm text-gray-400">กำลังอัปเดต...</p>
                )}

                <div className="grid md:grid-cols-4 lg:grid-cols-6 grid-cols-2 gap-x-4 gap-y-6">
                    {restaurants.length > 0 ? (
                        restaurants.map((restaurant, i) => (
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
                        ))
                    ) : (
                        <div className="col-span-full flex items-center justify-center min-h-screen text-gray-500 text-lg">
                            ไม่มีร้านอาหารที่พร้อมให้บริการในขณะนี้
                        </div>
                    )}
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