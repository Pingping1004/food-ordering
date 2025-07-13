"use client";

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Image from 'next/image';
import { getParamId } from '@/util/param';

export default function FailedOrderPage() {
    const params = useParams();
    const orderId = getParamId(params.orderId);

    const [restaurantName, setRestaurantName] = useState<string | null>(null);
    const [, setRestaurantId] = useState<string | null>(null);
    const [, setOrder] = useState();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            setError('No Order ID found in URL.');
            return;
        }
        const fetchData = async () => {
            try {
                const orderResponse = await api.get(`order/${orderId}`);
                setOrder(orderResponse.data);

                const newRestaurantId = orderResponse.data.restaurantId;
                setRestaurantId(newRestaurantId);
                const restaurantResponse = await api.get(`restaurant/${newRestaurantId}`);

                const newRestaurantName = restaurantResponse.data.name;
                setRestaurantName(newRestaurantName);
            } catch {
                setError('Error fetching order data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [orderId]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="flex flex-col py-10 px-6 gap-y-23">
            <h1 className="flex justify-center noto-sans-bold text-primary text-2xl">{restaurantName}</h1>

            <div className="flex flex-col justify-center items-center gap-y-10">
                <Image
                    src="/fail.svg"
                    width={120}
                    height={120}
                    alt="Failed icon"
                />
                <div className="flex flex-col items-center gap-y-1">
                    <h4 className="text-lg text-success noto-sans-regular">ชำระเงินล้มเหลว</h4>
                    <h1 className="text-2xl noto-sans-bold text-primary">ออเดอร์ {orderId?.substring(0, 4)}</h1>
                </div>
            </div>

            <div>
        Aside section
            </div>
        </div>
    )
}