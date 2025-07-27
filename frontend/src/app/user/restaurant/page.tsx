"use client";

import { RestaurantProfile } from "@/components/users/RestaurantProfile";
import React, { useEffect, useState } from "react";
import { Restaurant } from "@/context/MenuContext";
import { api } from "@/lib/api";
import UserHeader from "@/components/users/Header";
import LoadingPage from "@/components/LoadingPage";

export default function UserHomePage() {
    const [data, setData] = useState<Restaurant[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get<Restaurant[]>(`/restaurant`);
                setData(response.data)
            } catch {
                setError('Error fetching data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <LoadingPage />
    if (error) return <div>{error}</div>;
    if (!data) return <div>No Data found</div>

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <UserHeader />
            <div className="grid md:grid-cols-4 lg:grid-cols-6 grid-cols-2 gap-x-4 gap-y-6">
                {data.map((restaurant) => {

                    return (
                        <RestaurantProfile
                            key={restaurant.restaurantId}
                            name={restaurant.name}
                            categories={restaurant.categories}
                            restaurantId={restaurant.restaurantId}
                            restaurantImg={restaurant.restaurantImg}
                            isOpen={restaurant.isActuallyOpen}
                            variant={restaurant.isActuallyOpen ? "isOpen" : "isClose"}
                        />
                    );
                })}
            </div>
        </div>
    )
}