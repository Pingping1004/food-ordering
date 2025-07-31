"use client";

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Image from 'next/image';
import { getParamId } from '@/util/param';
import { OrderMenuType } from '@/components/users/OrderList';
import { OrderStatus } from '@/components/cookers/OrderNavbar';
import { Button } from '@/components/Button';
import { getTimeFormat } from '@/util/time';
import LoadingPage from '@/components/LoadingPage';

interface Order {
    orderMenus: OrderMenuType[];
    status: OrderStatus;
    orderAt: string;
    deliverAt: string;
}

const getOrderStatusProps = (currentStatus: OrderStatus) => {
    switch (currentStatus) {
        case OrderStatus.receive:
            return { renderStatus: 'รับออเดอร์', nextStatus: OrderStatus.cooking };
        case OrderStatus.cooking:
            return { renderStatus: 'เริ่มปรุงอาหาร', nextStatus: OrderStatus.ready };
        case OrderStatus.ready:
            return { renderStatus: 'พร้อมเสิร์ฟ', nextStatus: OrderStatus.done }; // Text for marking as done
        case OrderStatus.done:
            return { text: 'ออเดอร์เสร็จสิ้น' }; // Text for marking as done
        default: // Should ideally not be hit
            return { renderStatus: 'สถานะไม่ทราบ', nextStatus: currentStatus };
    }
};

export default function DoneOrderPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = getParamId(params.orderId);

    const [restaurantName, setRestaurantName] = useState<string | null>(null);
    const [, setRestaurantId] = useState<string | null>(null);
    const [order, setOrder] = useState<Order>();
    const { orderMenus = [] } = order || {};
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasRedirectedRef = useRef<boolean>(false);
    const { renderStatus } = getOrderStatusProps(order?.status as OrderStatus);

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

                if (orderResponse.data.isPaid === "unpaid" && !hasRedirectedRef.current) {
                    hasRedirectedRef.current = true;
                    alert('กรุณาชำระเงินก่อน');
                    const createPaymentResponse = await api.post(`/payment/create/${orderId}`);
                    const { checkoutUrl } = createPaymentResponse.data;
                    router.push(checkoutUrl);
                    return;
                }

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
    if (orderMenus.length === 0) {
        return <div>ไม่พบข้อมูลเมนู</div>;
    }
    if (error) return <div>{error}</div>;

    return (
        <div className="flex flex-col py-10 px-6 gap-y-10">
            <h1 className="flex justify-center noto-sans-bold text-primary text-2xl">{restaurantName}</h1>

            <main className="flex flex-col justify-center items-center gap-y-10">
                <Image
                    src="/success.svg"
                    width={120}
                    height={120}
                    priority
                    alt="Success icon"
                />
                <div className="flex flex-col items-center gap-y-1">
                    <h4 className="text-lg text-success noto-sans-regular">ส่งออเดอร์สำเร็จ</h4>
                    <h1 className="text-2xl noto-sans-bold text-primary">ออเดอร์ {orderId?.substring(0, 4)}</h1>
                </div>
            </main>


            <section className="flex justify-between mt-0">
                <div className="flex flex-col gap-y-4 border-r-[#B6B6B6] text-start text-lg">
                    <p>สั่งเมื่อ: {getTimeFormat(order.orderAt)}</p>
                    <p className="text-base">พร้อมเสิร์ฟ: {getTimeFormat(order.deliverAt)}</p>
                </div>

                <div className="flex flex-col gap-y-4 text-start text-lg">
                    <p className="text-xl noto-sans-bold">สถานะ</p>
                    <p>{renderStatus}</p>
                </div>
            </section>

            <section className="flex flex-col justify-between gap-y-6">
                <p className="noto-sans-bold text-lg text-primary">รายละเอียดออเดอร์</p>
                <div>
                    {order.orderMenus.map((item) => (
                        <div key={item.menuName} className="flex justify-between gap-y-2">
                            <p className="noto-sans-regular text-base text-primary">{item.quantity}x{' '}-{' '}{item.menuName}</p>
                            <p className="noto-sans-bold text-xl text-primary">{item.unitPrice}</p>
                        </div>
                    ))}
                </div>
            </section>

            <Button
                type="button"
                onClick={() => router.push('/user/restaurant')}
            >
                กลับสู่หน้าหลัก
            </Button>
        </div>
    )
}