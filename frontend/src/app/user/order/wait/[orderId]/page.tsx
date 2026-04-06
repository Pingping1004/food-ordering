"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getParamId } from "@/util/param";
import type { Order } from "../../done/[orderId]/page";
import { OrderStatus } from "@/components/cookers/OrderNavbar";
import LoadingPage from "@/components/LoadingPage";

function OrderWaitPage() {
    const router = useRouter();
    const params = useParams();
    const orderId = getParamId(params.orderId);

    const [order, setOrder] = useState<Order>();
    const [loading, setLoading] = useState(true);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const stopPolling = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await api.get(`/order/${orderId}`);
                const data = res.data;
                console.log("status:", data.status, OrderStatus.cancelled);

                setOrder(data);
                setLoading(false);

                if (data.status === OrderStatus.accepted) {
                    stopPolling()
                    router.replace(`/user/order/payment/${orderId}`);
                    return;
                }

                if (data.status === OrderStatus.cancelled || data.status === OrderStatus.rejected) {
                    stopPolling()
                    router.replace(`/user/order/failed/${orderId}`);
                    return;
                }

            } catch (err) {
                console.error(err);
            }
        };

        checkStatus();

        intervalRef.current = setInterval(checkStatus, 3000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [orderId, router]);

    if (!order) return <div>ไม่พบออเดอร์ของคุณ</div>;
    if (loading) <LoadingPage />

    const futureTime = new Date(new Date(order.orderAt).getTime() + 5 * 60 * 1000);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />

            <h2 className="text-lg font-noto-thai font-semibold">กำลังรอร้านยืนยันออเดอร์...</h2>

            <p className="text-gray-500 text-sm">กรุณารอสักครู่</p>

            <p className="pt-20">
                ออเดอร์จะถูกยกเลิกอัตโนมัติภายใน{" "}
                {futureTime.toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            </p>
        </div>
    );
}

export default OrderWaitPage;