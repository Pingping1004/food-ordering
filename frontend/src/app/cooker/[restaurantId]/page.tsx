"use client"

import dynamic from "next/dynamic";
import { OrderProps } from "@/components/cookers/Order";
import { NavState, OrderStatus } from "@/components/cookers/OrderNavbar";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/Button";
import { useCooker } from "@/context/Cookercontext";
import { api } from "@/lib/api";
import { getDateFormat, getTimeFormat } from "@/util/time";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";
import { useParams, usePathname } from "next/navigation";
import { getParamId } from "@/util/param";
import { useOrderSounds } from "@/hook/useOrderSounds";

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
    const { playNewOrderSound, playPaymentSound } = useOrderSounds();
    const [navbarStatus, setNavbarStatus] = useState<NavState>("sent");
    const [showAutoCancelModal, setShowAutoCancelModal] = useState(false)
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [now, setNow] = useState(Date.now());
    const [showRuleBanner, setShowRuleBanner] = useState(true);

    const ordersRef = useRef<Record<string, OrderProps>>({});
    const fetchingRef = useRef<boolean>(false);
    const pollingIntervalRef = useRef(3000)
    const pendingOrdersRef = useRef<Record<string, { order: OrderProps; showAt: number }>>({});

    const params = useParams();
    const restaurantId = getParamId(params.restaurantId);

    const segments = usePathname().split("/").filter(Boolean);
    const isOrderPage = Boolean(restaurantId) && segments.length === 2;

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
        fetchingRef.current = true;

        try {
            const url = lastTimestampRef.current
                ? `/order/new/${restaurantId}?after=${lastTimestampRef.current}`
                : `/order/new/${restaurantId}`;
            const response = await api.get(url)
            const data = response.data

            if (data.latestTimestamp) lastTimestampRef.current = data.latestTimestamp;

            // No new orders → slow down polling
            if (!data.orders || data.orders.length === 0) {
                pollingIntervalRef.current = Math.min(pollingIntervalRef.current + 1000, 8000);
            } else {
                // New orders → speed up polling
                pollingIntervalRef.current = 3000;
                const now = Date.now()

                // Stage new orders (with dedup protection)
                for (const order of data.orders) {
                    const existingOrder = ordersRef.current[order.orderId];

                    if (existingOrder) {
                        const justPaid = order.paymentStatus === "paid" && existingOrder.paymentStatus !== "paid"

                        setOrders(prev => ({
                            ...prev,
                            [order.orderId]: { ...prev[order.orderId], ...order }
                        }));

                        if (justPaid) playPaymentSound();
                    } else {
                        if (!pendingOrdersRef.current[order.orderId]) {
                            const delayMs = 1000 + Math.random() * 2000;
                            pendingOrdersRef.current[order.orderId] = {
                                order,
                                showAt: now + delayMs,
                            };
                        } else {
                            pendingOrdersRef.current[order.orderId].order = order;
                        }
                    }
                }
            }

            const now = Date.now();
            const cutoff = now - 10000;
            const ready: { id: string; order: OrderProps }[] = [];

            for (const [id, val] of Object.entries(pendingOrdersRef.current)) {
                if (now >= val.showAt || val.showAt < cutoff) {
                    ready.push({ id, order: val.order });
                }
            }

            if (ready.length > 0) {
                playNewOrderSound();

                setOrders(prev => {
                    const next = { ...prev };

                    for (const { id, order } of ready) {
                        next[id] = order;
                        delete pendingOrdersRef.current[id]
                    }

                    return next;
                });
            }
        } finally {
            fetchingRef.current = false
        }
    }, [restaurantId, playNewOrderSound, playPaymentSound]);

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
        ordersRef.current = orders;
    }, [orders]);

    const fetchNewOrdersRef = useRef(fetchNewOrders);
    useEffect(() => {
        fetchNewOrdersRef.current = fetchNewOrders;
    }, [fetchNewOrders]);

    useEffect(() => {
        if (!restaurantId) return;

        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        const loop = async () => {
            if (!isMounted) return;

            if (!document.hidden && restaurantId) await fetchNewOrdersRef.current();
            if (isMounted) timeoutId = setTimeout(loop, pollingIntervalRef.current);
        };

        const init = async () => {
            await fetchInitialOrders();
            if (isMounted) loop();
        };

        init();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId)
        };
    }, [restaurantId, fetchInitialOrders]);

    useEffect(() => {
        const handleVisibility = () => {
            if (!document.hidden && isOrderPage) {
                fetchNewOrders();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [fetchNewOrders, isOrderPage]);

    useEffect(() => {
        if (!isOrderPage) {
            fetchingRef.current = false;
        }
    }, [isOrderPage]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setOrders(prev => {
                const next = { ...prev }
                const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;

                for (const id in next) {
                    if (new Date(next[id].orderAt).getTime() < cutoff) {
                        delete next[id]
                    }
                }
                return next
            })
        }, 60_000)

        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const seen = localStorage.getItem("cook_order_rules_seen")

        if (!seen) {
            setShowAutoCancelModal(true)
            localStorage.setItem("cook_large_text", "true")
        }
    }, [])

    const handleCloseBanner = () => { setShowRuleBanner(false) };
    const ordersArray = useMemo(() => Object.values(orders), [orders])
    const filterDailyOrders = useMemo(() => {
        const startOfYesterday = new Date();
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        startOfYesterday.setHours(0, 0, 0, 0);

        return ordersArray.filter((order) => new Date(order.orderAt) >= startOfYesterday);
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

    const isRejectedDisabled = (orderAt: Date, deliverAt: Date): boolean => {
        const elapsedMins = (now - new Date(orderAt).getTime()) / 60000;
        const beforeDeliverMins = (new Date(deliverAt).getTime() - now) / 60000;

        return elapsedMins > 3 || beforeDeliverMins < 5;
    };

    const isDelayDisabled = (acceptedAt: Date, deliverAt: Date): boolean => {
        const elapsedMins = (now - new Date(acceptedAt).getTime()) / 60000;
        const beforeDeliverMins = (new Date(deliverAt).getTime() - now) / 60000;

        return elapsedMins > 5 || beforeDeliverMins < 5;
    };

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
                        <h2 className={`${isLargeTextMode ? "text-2xl" : "text-xl"} font-bold text-primary`}>ยอดขายรวม: {dailySales.toFixed(2)}</h2>

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
                        isDelayDisabled={isDelayDisabled(new Date(order.acceptAt ?? order.orderAt), new Date(order.deliverAt))}
                        isRejectedDisabled={isRejectedDisabled(new Date(order.orderAt), new Date(order.deliverAt))}
                        className="mb-4"
                        onDelayUpdate={handleDelayOrder}
                        onStatusUpdate={handleUpdateStatus}
                    />
                ))}
            </main>

            <Modal
                isOpen={showAutoCancelModal}
                onClose={() => setShowAutoCancelModal(false)}
                title="กฎการจัดการออเดอร์"
                body={`• ต้องกดรับออเดอร์ภายใน 3 นาที มิฉะนั้นระบบจะยกเลิกอัตโนมัติ
                    • สามารถกดปฏิเสธออเดอร์ได้ภายใน 3 นาทีหลังจากลูกค้าสั่ง
                    • แจ้งล่าช้าได้ภายใน 5นาทีหลังรับออเดอร์และ5นาทีก่อนลูกค้าจะมารับ
                    
                    กรุณาตรวจสอบออเดอร์และดำเนินการให้ทันเวลา`
                }
                confirmText="รับทราบ"
            />
        </div>
    );
}

export default function CookerHomePage() {
    return (
        <Page />
    )
}