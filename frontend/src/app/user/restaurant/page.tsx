"use client";

import { Button } from "@/components/Button";
import { RestaurantProfile } from "@/components/users/RestaurantProfile";
import React, { useEffect, useState } from "react";
import { Restaurant } from "@/context/MenuContext";

import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";


export default function UserHomePage() {
    const { cart } = useCart();
    const [data, setData] = useState<Restaurant[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get<Restaurant[]>(`/restaurant`);
                setData(response.data);
            } catch (error) {
                setError('Error fetching data');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!data) return <div>No Data found</div>

    console.log('Fetch restaurant data: ', data);

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <header className="flex justify-between items-center">
                <h1 className="noto-sans-bold text-2xl">วันนี้กินอะไรดี?</h1>
                <Button
                    size="md"
                    type="button"
                    {...(cart.length > 0 && { numberIcon: cart.length })}
                >
                    ออเดอร์ของคุณ
                </Button>
            </header>
            <h1>Hello World</h1>
            {data.map((restaurant) => {

                return (
                    <RestaurantProfile
                        key={restaurant.restaurantId}
                        name={restaurant.name}
                        categories={restaurant.categories}
                        openTime={restaurant.openTime}
                        closeTime={restaurant.closeTime}
                        restaurantId={restaurant.restaurantId}
                        restaurantImg={restaurant.restaurantImg}
                        variant="isOpen"
                    />
                );
            })}
        </div>
    )
}