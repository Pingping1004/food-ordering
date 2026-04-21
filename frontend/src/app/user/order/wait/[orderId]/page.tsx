"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getParamId } from "@/util/param";
import type { Order } from "../../done/[orderId]/page";
import { OrderStatus } from "@/components/cookers/OrderNavbar";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/Button";
import { toastDanger } from "@/components/ui/Toast";
import { useCart } from "@/context/CartContext";

function OrderWaitPage() {
    const router = useRouter();
    const { clearCart } = useCart();
    const params = useParams();
    const orderId = getParamId(params.orderId);

    const [order, setOrder] = useState<Order>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isTimeout, setIsTimeout] = useState(false);

    const failCountRef = useRef(0);
    const orderSecretRef = useRef<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastSuccessRef = useRef(Date.now());


    const stopPolling = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const checkStatus = async () => {
        try {
            const res = await api.get(`/order/${orderId}`, {
                headers: {
                    'x-order-secret': orderSecretRef.current
                }
            });
            const data = res.data;

            setOrder(data);
            setLoading(false);
            setIsTimeout(false);
            setError(false);
            failCountRef.current = 0
            lastSuccessRef.current = Date.now();

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

        } catch (error: unknown) {
            failCountRef.current += 1;

            if (failCountRef.current >= 3) {
                stopPolling();
                setError(true);
                toastDanger("ไม่สามารถโหลดสถานะออเดอร์ได้");
            }
        }
    };

    const handleRetry = () => {
        stopPolling();

        setError(false);
        setIsTimeout(false);
        failCountRef.current = 0;
        lastSuccessRef.current = Date.now();
        setLoading(true);

        checkStatus();
        intervalRef.current = setInterval(checkStatus, 3000);
    };

    useEffect(() => {
        if (!orderId) {
            router.replace("/user/restaurant");
            return;
        }
    
        const orderSecret = localStorage.getItem(`orderSecret:${orderId}`);
        orderSecretRef.current = orderSecret;
    
        checkStatus();
        intervalRef.current = setInterval(checkStatus, 3000);
    
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [orderId]);

    useEffect(() => {
        clearCart();
    }, []);

    useEffect(() => {
        const t = setInterval(() => {
            if (Date.now() - lastSuccessRef.current > 8000) {
                setIsTimeout(true);
                stopPolling();
            }
        }, 2000);

        return () => clearInterval(t);
    }, []);

    if (loading) return <LoadingPage />
    if (error || isTimeout) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <p className="text-lg font-semibold">
                    ไม่สามารถโหลดสถานะออเดอร์ได้
                </p>

                <Button
                    type="button"
                    onClick={handleRetry}
                    className="px-4 py-2 bg-primary text-white rounded"
                >
                    ลองใหม่
                </Button>
            </div>
        )
    }
    if (!order) return <div>ไม่พบออเดอร์ของคุณ</div>;

    const futureTime = new Date(new Date(order.orderAt).getTime() + 3 * 60 * 1000);

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