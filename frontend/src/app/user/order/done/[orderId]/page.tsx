"use client";

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getParamId } from '@/util/param';
import { OrderMenuType } from '@/components/users/OrderList';
import { OrderStatus, PaymentStatus } from '@/components/cookers/OrderNavbar';
import { Button } from '@/components/Button';
import { getTimeFormat } from '@/util/time';
import LoadingPage from '@/components/LoadingPage';
import { toastDanger } from '@/components/ui/Toast';
import { SuccessIcon } from '@/components/ui/icon/success';

export interface Order {
    restaurantId: string;
    orderMenus: OrderMenuType[];
    status: OrderStatus;
    orderAt: string;
    deliverAt: string;
    paymentStatus: PaymentStatus
    totalAmount: number
    restaurant: {
        paymentQr: string
    }
}

export default function DoneOrderPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = getParamId(params.orderId);

    const [restaurantName, setRestaurantName] = useState<string | null>(null);
    const [order, setOrder] = useState<Order>();
    const { orderMenus = [] } = order || {};
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasRedirectedRef = useRef<boolean>(false);

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
                    headers: { "x-order-secret": orderSecret } 
                });
                setOrder(orderResponse.data);

                if (orderResponse.data.isPaid === "unpaid" && !hasRedirectedRef.current) {
                    hasRedirectedRef.current = true;
                    toastDanger('กรุณาชำระเงินก่อน');
                    router.push(`/user/order/confirm/${orderId}`);
                    return;
                }

                const newRestaurantId = orderResponse.data.restaurantId;
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
    }, [orderId, router]);

    if (loading) return <LoadingPage />
    if (!order) return <div>ไม่พบออเดอร์ของคุณ</div>;
    if (orderMenus.length === 0) {
        return <div>ไม่พบข้อมูลเมนู</div>;
    }
    if (error) return <div>{error}</div>;

    return (
        <div className="flex flex-col py-10 px-6 gap-y-10">
            <h1 className="flex justify-center font-noto-thai text-bold text-primary text-2xl">{restaurantName}</h1>

            <main className="flex flex-col justify-center items-center gap-y-10">
                <SuccessIcon />

                <div className="flex flex-col items-center gap-y-1">
                    <h4 className="text-lg text-success font-noto-thai">ส่งออเดอร์สำเร็จ</h4>
                    <h1 className="text-2xl font-noto-thai text-bold text-primary">ออเดอร์ {orderId?.substring(0, 4)}</h1>
                </div>
            </main>


            <section className="flex justify-between mt-0">
                <p className="text-xl font-semibold">สั่งเมื่อ: {getTimeFormat(order.orderAt)}</p>
                <p className="text-xl font-semibold">พร้อมเสิร์ฟ: {getTimeFormat(order.deliverAt)}</p>
            </section>

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