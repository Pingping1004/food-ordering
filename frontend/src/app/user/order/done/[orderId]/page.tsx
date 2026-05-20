"use client";

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getParamId } from '@/util/param';
import { OrderMenuType } from '@/components/users/OrderList';
import { OrderStatus, PaymentStatus } from '@/components/cookers/OrderNavbar';
import { Button } from '@/components/Button';
import { convertDateToTimeString, getTimeFormat } from '@/util/time';
import { useCooker } from '@/hook/useCooker';
import { esimatedDeliveryTimeRange } from '@/lib/calculate-time';
import LoadingPage from '@/components/LoadingPage';
import { toastDanger } from '@/components/ui/Toast';
import { SuccessIcon } from '@/components/ui/icon/success';

export interface Order {
    restaurantId: string;
    orderMenus: OrderMenuType[];
    status: OrderStatus;
    orderAt: string;
    acceptAt: string;
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
    const [restaurantId, setRestaurantId] = useState<string>("");
    const [order, setOrder] = useState<Order>();
    const [orderAmount, setOrderAmount] = useState<number>(0);
    const { orderMenus = [] } = order || {};
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasRedirectedRef = useRef<boolean>(false);

    const { data: cooker} = useCooker(restaurantId);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
                const orderResponse = await api.get(`order/${orderId}`, {
                    headers: { "x-order-secret": orderSecret }
                });

                const data = orderResponse.data;
                setOrder(data);

                if (data.paymentStatus === "unpaid" && !hasRedirectedRef.current) {
                    console.log('data.paymentStatus', data.paymentStatus);
                    console.log('hasRedirectedRef.current', hasRedirectedRef.current);

                    hasRedirectedRef.current = true;
                    toastDanger('ยังไม่ได้ชำระเงิน');
                    router.push(`/user/order/failed/${orderId}`);
                    return;
                }

                const newRestaurantName = data.name;
                const newRestaurantId = data.restaurantId;
                setRestaurantName(newRestaurantName);
                setRestaurantId(newRestaurantId);
            } catch {
                setError('Error fetching order data');
            } finally {
                setLoading(false);
            }
        };

    const fetchOrderAmnout = async (): Promise<void> => {
        const orderResponse = await api.get(`order/active-count/${cooker?.restaurantId}`);
        const data = orderResponse.data;

        setOrderAmount(data.activeOrderCount);
    }

        fetchData();
        fetchOrderAmnout();
    }, [orderId, router]);

    if (loading) return <LoadingPage />
    if (!order) return <div>ไม่พบออเดอร์ของคุณ</div>;
    if (orderMenus.length === 0) return <div>ไม่พบข้อมูลเมนู</div>;
    if (!cooker) return <div>ไม่พบร้านอาหาร</div>;
    if (error) return <div>{error}</div>;


    const { min, max} = esimatedDeliveryTimeRange(cooker?.avgCookingTime, orderAmount);
    const minEstimatedTimeString = convertDateToTimeString(min);
    const maxEstimatedTimeString = convertDateToTimeString(max);

    console.log("Min: ", min);
    console.log("Max: ", max);
    console.log("Timestring: ", minEstimatedTimeString, maxEstimatedTimeString);
    console.log("Deliver at: ", order.deliverAt)

    return (
        <div className="flex flex-col py-10 px-6 gap-y-12">
            <h1 className="flex justify-center font-noto-thai text-bold text-primary text-2xl">{restaurantName}</h1>

            <main className="flex flex-col justify-center items-center gap-y-10">
                <SuccessIcon />

                <div className="flex flex-col items-center gap-y-1">
                    <h4 className="text-lg text-success font-noto-thai">ส่งออเดอร์สำเร็จ</h4>
                    <h1 className="text-2xl font-bold text-primary">ออเดอร์ {orderId?.substring(0, 4)}</h1>
                </div>
            </main>


            <section className="flex justify-between mt-0">
                <p className="text-xl font-semibold">เสร็จโดยประมาณ: 
                    <br />
                    {minEstimatedTimeString}-{maxEstimatedTimeString}
                </p>
                <p className="text-xl font-semibold">
                    เวลาที่ต้องการรับ: <br />
                    {getTimeFormat(order.deliverAt)}
                </p>
            </section>

            <section className="flex flex-col justify-between gap-y-6">
                <p className="font-bold text-lg text-primary">รายละเอียดออเดอร์</p>
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