"use client"

import dynamic from "next/dynamic";
import { OrderProps } from "@/components/cookers/Order";
import { NavState, OrderStatus, PaymentStatus } from "@/components/cookers/OrderNavbar";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/Button";
import { CookerProvider, useCooker } from "@/context/Cookercontext";
import { api } from "@/lib/api";
import { getDateFormat, getTimeFormat } from "@/util/time";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";
import { useParams } from "next/navigation";
import { getParamId } from "@/util/param";

const Modal = dynamic(() => import("../../../components/users/Modal"), { ssr: false })
const WarningBanner = dynamic(() => import("../../../components/cookers/WarningBanner"), { ssr: false })
const CookerHeader = dynamic(() => import("../../../components/cookers/CookerHeader"), { ssr: false })
const Order = dynamic(() => import("../../../components/cookers/Order"), { ssr: false })
const OrderNavBar = dynamic(() => import("../../../components/cookers/OrderNavbar"), { ssr: false })

function Page() {
    const [isLargeTextMode, setIsLargeTextMode] = useState(false)
    const [orders, setOrders] = useState<Record<string, OrderProps>>({});
    const lastTimestampRef = useRef<string | null>(null)
    const { cooker } = useCooker();
    const [navbarStatus, setNavbarStatus] = useState<NavState>("sent");
    const [showAutoCancelModal, setShowAutoCancelModal] = useState(false)
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [now, setNow] = useState(new Date());
    const [showRuleBanner, setShowRuleBanner] = useState(true);

    const fetchingRef = useRef(false);
    const pendingOrdersRef = useRef<Record<string, { order: OrderProps; showAt: number }>>({});

    const params = useParams();
    const restaurantId = getParamId(params.restaurantId);

    const fetchInitialOrders = useCallback(async () => {
        const response = await api.get(`/order/today/${restaurantId}`);
        const data = response.data;

        const mapped: Record<string, OrderProps> = {};

        for (const order of data.orders) {
            mapped[order.orderId] = order;
        }

        setOrders(mapped);

        if (data.latestTimestamp) lastTimestampRef.current = data.latestTimestamp;

        setIsLoading(false);
    }, [restaurantId]);

    const fetchNewOrders = useCallback(async () => {
        if (fetchingRef.current) return
        fetchingRef.current = true

        try {
            const params = new URLSearchParams()
            if (lastTimestampRef.current) params.append("after", lastTimestampRef.current)

            const url = `/order/new/${restaurantId}` + (params.toString() ? `?${params.toString()}` : "");
            const response = await api.get(url)
            const data = response.data

            if (data.orders.length > 0) {
                // Stage new orders into the pending buffer with a random delay
                for (const order of data.orders) {
                    if (!pendingOrdersRef.current[order.orderId]) {
                        const delayMs = 1000 + Math.random() * 2000;
                        pendingOrdersRef.current[order.orderId] = { order, showAt: Date.now() + delayMs }
                    }
                }

                if (data.latestTimestamp) lastTimestampRef.current = data.latestTimestamp
            }

            const now = Date.now()
            const ready = Object.entries(pendingOrdersRef.current)
                .filter(([, { showAt }]) => now >= showAt)
                .map(([id, { order }]) => ({ id, order }));

            if (ready.length > 0) {
                setOrders(prev => {
                    const next = { ...prev };

                    for (const { id, order } of ready) {
                        next[id] = order;
                        delete pendingOrdersRef.current[id]
                    }

                    // Clean up orders older than 2 days
                    const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
                    for (const id in next) {
                        if (new Date(next[id].orderAt).getTime() < cutoff) delete next[id];
                    }

                    return next;
                })
            }
        } finally {
            setIsLoading(false)
            fetchingRef.current = false
        }
    }, [restaurantId]);

    const handleTextMode = () => {
        const newValue = !isLargeTextMode
        setIsLargeTextMode(newValue);
        localStorage.setItem("large_text_mode", JSON.stringify(newValue))
    }

    const handleDelayOrder = async (orderId: string) => {
        const previousOrder = orders[orderId];

        setOrders(prev => ({
            ...prev,
            [orderId]: {
                ...prev[orderId],
                isDelay: true,
            }
        }));

        try {
            const response = await api.patch(`/order/delay/${orderId}`, { isDelay: true });
            const updatedOrder = response.data.result;

            setOrders(prev => ({ ...prev, [orderId]: updatedOrder }))
            toastSuccess(response.data.message)
        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };
                const backendMessage = err.response.data?.message;

                setOrders(prev => ({
                    ...prev,
                    [orderId]: previousOrder,
                }));

                toastDanger(backendMessage ?? "แจ้งออเดอร์ล่าช้าล้มเหลว");
            }
        }
    }

    const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
        const previousOrder = orders[orderId];

        setOrders(prev => ({
            ...prev,
            [orderId]: {
                ...prev[orderId],
                status,
            }
        }));

        try {
            let endpoint = "";

            switch (status) {
                case "accepted": endpoint = `/order/accept/${orderId}`; break;
                case "rejected": endpoint = `/order/reject/${orderId}`; break;
                case "cancelled": endpoint = `/order/cancel/${orderId}`; break;
                case "completed": endpoint = `/order/complete/${orderId}`; break;
                default: throw new Error("Invalid status update");
            }

            const response = await api.patch(endpoint);
            const updatedOrder = response.data.result;

            setOrders(prev => ({
                ...prev,
                [orderId]: {
                    ...prev[orderId],
                    ...updatedOrder,
                }
            }));

            toastSuccess(response.data.message);

        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };
                const backendMessage = err.response.data?.message;

                setOrders(prev => ({
                    ...prev,
                    [orderId]: previousOrder,
                }));

                toastDanger(backendMessage ?? `อัพเดทสถานะออเดอร์เป็น${status}ล้มเหลว`);
            }
        }
    };

    useEffect(() => {
        const saved = localStorage.getItem("cook_large_text");

        if (saved) setIsLargeTextMode(JSON.parse(saved));

    }, []);

    useEffect(() => {
        if (!restaurantId) return;

        let interval: ReturnType<typeof setInterval>;
        const init = async () => {
            await fetchInitialOrders();
            interval = setInterval(fetchNewOrders, 1500)
        };

        init();

        return () => clearInterval(interval);
    }, [restaurantId, fetchInitialOrders, fetchNewOrders]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const seen = localStorage.getItem("cook_order_rules_seen")

        if (!seen) {
            setShowAutoCancelModal(true)
            localStorage.setItem("cook_order_rules_seen", "true")
        }
    }, [])

    const handleCloseBanner = () => { setShowRuleBanner(false) };
    const ordersArray = useMemo(() => Object.values(orders), [orders])
    const filterDailyOrders = useMemo(() => {
        const startOfYesterday = new Date();
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        startOfYesterday.setHours(0, 0, 0, 0);

        return ordersArray.filter((order) => order.paymentStatus === PaymentStatus.paid || PaymentStatus.refund_pending || PaymentStatus.refund_complete &&
            new Date(order.orderAt) >= startOfYesterday);
    }, [ordersArray]);

    const dailyDone = useMemo(() => {
        return filterDailyOrders.filter((order) => (order.status === OrderStatus.completed && order.paymentStatus === "paid" && order.completedAt)).length;
    }, [filterDailyOrders]);

    const dailySales = useMemo(() => {
        return filterDailyOrders.filter((order) => order.paymentStatus === "paid" && order.status === OrderStatus.completed && order.completedAt)
            .reduce((total, order) => total + Number(order.totalAmount), 0);
    }, [filterDailyOrders]);

    const handleNavbarChange = (status: NavState) => {
        setNavbarStatus(status);
    };

    const isButtonDisabled = (orderAt: Date, deliverAt: Date, bufferMins: number): boolean => {
        const elapsedMs = now.getTime() - new Date(orderAt).getTime();
        const elapsedMins = elapsedMs / 1000 / 60;

        const beforeDeliverMs = new Date(deliverAt).getTime() - now.getTime();
        const beforeDeliverMins = beforeDeliverMs / 1000 / 60;

        return elapsedMins > bufferMins && beforeDeliverMins > 5;
    }

    const navToStatusMap: Record<NavState, OrderStatus[]> = useMemo(() => ({
        sent: [OrderStatus.sent],
        accepted: [OrderStatus.accepted],
        completed: [OrderStatus.completed],
        cancelled_group: [OrderStatus.cancelled, OrderStatus.rejected],
    }), []);

    const filterTodayOrderStatus: OrderProps[] = useMemo(() => {
        const allowedStatuses = navToStatusMap[navbarStatus];
        const filtered = filterDailyOrders.filter(order => allowedStatuses.includes(order.status));

        if (navbarStatus === 'completed' || navbarStatus === 'cancelled_group') {
            return filtered.sort((a, b) => new Date(b.orderAt).getTime() - new Date(a.orderAt).getTime());
        }

        return filtered.sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime());
    }, [navbarStatus, filterDailyOrders, navToStatusMap]);

    if (isLoading) return <LoadingPage />

    return (
        <div
            className={`flex flex-col py-10 px-6 transition-all duration-200
            ${isLargeTextMode ? "gap-y-14 text-lg" : "gap-y-10 "}`}
        >
            <CookerHeader
                restaurantId={cooker.restaurantId}
                name={cooker.name}
                openTime={cooker?.openTime}
                closeTime={cooker?.closeTime}
            />

            <Button
                variant="secondary"
                size={isLargeTextMode ? "lg" : "md"}
                type="button"
                onClick={handleTextMode}
                className="self-end px-4 py-2 rounded-lg bg-primary-light text-sm font-semibold "
            >
                {isLargeTextMode ? "โหมดตัวอักษรปกติ" : "โหมดตัวอักษรใหญ่"}
            </Button>

            <OrderNavBar
                status={navbarStatus}
                isLargeTextMode={isLargeTextMode}
                onStatusUpdate={handleNavbarChange}
            />

            {showRuleBanner && (
                <WarningBanner
                    isLargeTextMode={isLargeTextMode}
                    onClose={handleCloseBanner}
                />
            )}

            {navbarStatus === OrderStatus.completed ? (
                <section className="flex flex-col gap-y-6">
                    <h1 className={`${isLargeTextMode ? "text-3xl" : "text-2xl"} font-bold text-primary`}>สรุปรายวัน</h1>
                    <div className="flex justify-between items-center">
                        <h2 className={`${isLargeTextMode ? "text-2xl" : "text-xl"} font-bold text-primary`}>ยอดขายรวม: {dailySales}</h2>

                        <p className={`${isLargeTextMode ? "text-2xl" : "text-xl"} text-secondary`}>ออเดอร์วันนี้: {dailyDone}</p>
                    </div>
                </section>
            ) : ('')}

            <main>
                {filterTodayOrderStatus.map((order) => (
                    <Order
                        key={order.orderId}
                        orderId={order.orderId}
                        totalAmount={order.totalAmount}
                        isDelay={order.isDelay}
                        status={order.status}
                        orderAt={`${getTimeFormat(order.orderAt)} ${getDateFormat(new Date(order.orderAt))}`}
                        deliverAt={order.deliverAt}
                        paymentStatus={order.paymentStatus}
                        orderMenus={order.orderMenus}
                        details={order.details}
                        userTel={order.userTel}
                        isLargeTextMode={isLargeTextMode}
                        isDelayDisabled={isButtonDisabled(new Date(order.orderAt), new Date(order.deliverAt), 10)}
                        isRejectedDisabled={isButtonDisabled(new Date(order.orderAt), new Date(order.deliverAt), 5)}
                        className="mb-4"
                        selected="default"
                        onDelayUpdate={handleDelayOrder}
                        onStatusUpdate={handleUpdateStatus}
                    />
                ))}
            </main>

            <Modal
                isOpen={showAutoCancelModal}
                onClose={() => setShowAutoCancelModal(false)}
                title="กฎการจัดการออเดอร์"
                body={`• ต้องกดรับออเดอร์ภายใน 5 นาที มิฉะนั้นระบบจะยกเลิกอัตโนมัติ และร้านจะไม่ได้รับเงิน
                    • สามารถกดปฏิเสธออเดอร์ได้ภายใน 5 นาทีหลังจากลูกค้าสั่ง
                    • หลังจากรับออเดอร์แล้ว สามารถกด "แจ้งล่าช้า" ได้ภายใน 10 นาทีเท่านั้น
                    • แจ้งล่าช้าได้ภายใน 5 นาทีก่อนลูกค้าจะมารับ
                    
                    กรุณาตรวจสอบออเดอร์และดำเนินการให้ทันเวลา`
                }
                confirmText="รับทราบ"
            />
        </div>
    );
}

export default function CookerHomePage() {
    return (
        <CookerProvider>
            <Page />
        </CookerProvider>
    )
}