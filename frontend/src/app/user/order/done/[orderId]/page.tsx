"use client";

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Image from 'next/image';
import { getParamId } from '@/util/param';
import { OrderMenuType } from '@/components/users/OrderList';
import { OrderStatus } from '@/components/cookers/OrderNavbar';

interface Order {
    orderMenu: OrderMenuType[];
    orderStatus: OrderStatus;
    orderAt: string;
    deliverAt: string;
}

export default function DoneOrderPage() {
    const params = useParams();
    const orderId = getParamId(params.orderId);

    const [restaurantName, setRestaurantName] = useState<string | null>(null);
    const [, setRestaurantId] = useState<string | null>(null);
    const [order, setOrder] = useState<Order>();
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
    if (!order) return <div>ไม่พบออเดอร์ของคุณ</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="flex flex-col py-10 px-6 gap-y-10">
            <h1 className="flex justify-center noto-sans-bold text-primary text-2xl">{restaurantName}</h1>

            <main className="flex flex-col justify-center items-center gap-y-10 mt-10">
                <Image
                    src="/success.svg"
                    width={120}
                    height={120}
                    alt="Success icon"
                />
                <div className="flex flex-col items-center gap-y-1">
                    <h4 className="text-lg text-success noto-sans-regular">ส่งออเดอร์สำเร็จ</h4>
                    <h1 className="text-2xl noto-sans-bold text-primary">ออเดอร์ {orderId?.substring(0, 4)}</h1>
                </div>
            </main>


            <section className="flex justify-between mt-0">
                <div className="flex flex-col border-r-[#B6B6B6] text-start">
                    <p>สั่งเมื่อ: {order.orderAt}</p>
                    <p>พร้อมเสิร์ฟ: {order.deliverAt}</p>
                </div>

                <div className="text-start">
                    <p>สถานะ:</p>
                    <p>{order.orderStatus}</p>
                </div>
            </section>

            <footer className="flex flex-col gap-y-6">
                <p className="noto-sans-bold text-base text-primary">รายละเอียดออเดอร์</p>
                <div>
                    {order.orderMenu.map((orderMenu) => {
                        return (
                            <div key={orderMenu.menuName} className="flex flex-col gap-y-2">
                                <p className="noto-sans-regular text-base text-primary">{orderMenu.quantity}x{' '}{orderMenu.menuName}</p>
                                <p className="noto-sans-bold text-xl text-primary">{orderMenu.unitPrice}</p>
                            </div>
                        );
                    })}
                </div>
            </footer>
        </div>
    )
}