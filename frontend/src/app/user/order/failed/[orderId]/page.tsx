"use client";

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import LoadingPage from '@/components/LoadingPage';
import { ErrorIcon } from '@/components/ui/icon/error';

export default function FailedOrderPage() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');

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
                const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
                const orderResponse = await api.get(`order/${orderId}`, {
                    headers: {
                        "x-order-secret": orderSecret
                    }
                });
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

    if (loading) return <LoadingPage />
    if (error) return <div>{error}</div>;

    return (
        <div className="flex flex-col py-10 px-6 gap-y-23">
            <h1 className="flex justify-center font-noto-thai text-bold text-primary text-2xl">{restaurantName}</h1>

            <div className="flex flex-col justify-center items-center gap-y-10">
                <ErrorIcon />

                <div className="flex flex-col items-center gap-y-1">
                    <h4 className="text-lg text-success font-noto-thai">ชำระเงินล้มเหลว</h4>
                    <h1 className="text-2xl font-noto-thai text-bold text-primary">ออเดอร์ {orderId?.substring(0, 4)}</h1>
                </div>
            </div>

            <div>
                Aside section
            </div>
        </div>
    )
}