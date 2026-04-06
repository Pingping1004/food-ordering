"use client";

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import LoadingPage from '@/components/LoadingPage';
import { ErrorIcon } from '@/components/ui/icon/error';
import { getParamId } from '@/util/param';
import type { Order } from '../../done/[orderId]/page';
import { Button } from '@/components/Button';

export default function FailedOrderPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = getParamId(params.orderId)

    const [restaurantName, setRestaurantName] = useState<string | null>(null);
    const [, setRestaurantId] = useState<string | null>(null);
    const [order, setOrder] = useState<Order>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            setError('ไม่พบออเดอร์ของคุณ');
            return;
        }
        const fetchData = async () => {
            try {
                const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
                const orderResponse = await api.get(`order/${orderId}`, {
                    headers: { "x-order-secret": orderSecret }
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
    if (!order) return <div>ไม่พบออเดอร์ของคุณ</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="flex flex-col py-10 px-6 gap-y-23">
            <h1 className="flex justify-center font-noto-thai text-bold text-primary text-2xl">{restaurantName}</h1>

            <div className="flex flex-col justify-center items-center gap-y-10">
                <ErrorIcon />

                <div className="flex flex-col items-center gap-y-1">
                    <h4 className="text-lg text-danger font-bold font-noto-thai">ออเดอร์ถูกยกเลิก</h4>
                    <h1 className="text-2xl font-noto-thai font-semibold text-primary">ออเดอร์ {orderId?.substring(0, 4)}</h1>
                </div>
            </div>

            <section className="flex flex-col justify-between gap-y-6">
                <p className="font-noto-thai text-bold text-lg text-primary">รายละเอียดออเดอร์</p>
                <div>
                    {order.orderMenus.map((item) => (
                        <div key={item.menuName} className="flex justify-between gap-y-2">
                            <p className="font-noto-thai text-lg text-primary">{item.quantity}x{' '}-{' '}{item.menuName}</p>
                            <p className="font-noto-thai text-bold text-2xl text-primary">{item.unitPrice}</p>
                        </div>
                    ))}
                </div>
            </section>

            <Button
                type="button"
                size="lg"
                onClick={() => router.push('/user/restaurant')}
            >
                <p className="">กลับสู่หน้าหลัก</p>
            </Button>
        </div>
    )
}