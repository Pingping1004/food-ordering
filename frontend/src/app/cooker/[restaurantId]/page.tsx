"use client"

import dynamic from "next/dynamic";
import { OrderProps } from "@/components/cookers/Order";
import { NavState, OrderStatus } from "@/components/cookers/OrderNavbar";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";
import { getDateFormat, getTimeFormat } from "@/util/time";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";
import { useParams, usePathname } from "next/navigation";
import { useOrderSounds } from "@/hook/useOrderSounds";
import { useCooker } from "@/hook/useCooker";
import { useAuth } from "@/auth/auth.hooks";
import {
    getNotificationPermission,
    registerNotificationServiceWorker,
    requestNotificationPermission,
    subscribeToForegroundMessages,
    syncCookerPushToken,
} from "@/lib/firebase-messaging";
import type { MessagePayload } from "firebase/messaging";

const Modal = dynamic(() => import("../../../components/users/Modal"), { ssr: false })
const WarningBanner = dynamic(() => import("../../../components/cookers/WarningBanner"), { ssr: false })
const CookerHeader = dynamic(() => import("../../../components/cookers/CookerHeader"), { ssr: false })
const Order = dynamic(() => import("../../../components/cookers/Order"), { ssr: false })
const OrderNavBar = dynamic(() => import("../../../components/cookers/OrderNavbar"), { ssr: false })
const InstallGuideModal = dynamic(() => import("../../../components/cookers/InstallGuideModal"), { ssr: false })

interface ServiceWorkerMessage {
    type?: "BACKGROUND_ORDER_RECEIVED" | "notification-click" | string;
    data?: {
        orderId?: string;
        type?: string; // e.g., "new_order"
        restaurantId?: string;
        [key: string]: string | undefined; // Catch-all for any other string data
    };
}

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PushBanner = {
    orderId: string;
    type: "new_order" | "payment_verified";
    title: string;
    body: string;
};

function isUnauthorizedError(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("response" in error)) return false;
    const err = error as { response?: { status?: number } };
    return err.response?.status === 401;
}

function isIosDevice() {
    if (typeof window === "undefined") return false;

    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
}

function isStandaloneMode() {
    if (typeof window === "undefined") return false;

    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function normalizePushPayload(payload: MessagePayload): PushBanner | null {
    const data = payload.data ?? {};
    const type = data.type;
    const orderId = data.orderId;

    if (!orderId || (type !== "new_order" && type !== "payment_verified")) {
        return null;
    }

    return {
        orderId,
        type,
        title: payload.notification?.title ?? data.title ?? (type === "new_order" ? "NEW ORDER" : "PAYMENT VERIFIED"),
        body: payload.notification?.body ?? data.body ?? "",
    };
}

function Page() {
    const [isLargeTextMode, setIsLargeTextMode] = useState(false)
    const [orders, setOrders] = useState<Record<string, OrderProps>>({});
    const [navbarStatus, setNavbarStatus] = useState<NavState>("sent");
    const [showAutoCancelModal, setShowAutoCancelModal] = useState(false)
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [now, setNow] = useState(Date.now());
    const [showRuleBanner, setShowRuleBanner] = useState(true);
    const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
    const [pushSyncState, setPushSyncState] = useState<"idle" | "syncing" | "ready" | "error">("idle");
    const [pushErrorMessage, setPushErrorMessage] = useState<string | null>(null);
    const [pushDebugMessage, setPushDebugMessage] = useState<string | null>(null);
    const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [activeBanner, setActiveBanner] = useState<PushBanner | null>(null);

    const lastTimestampRef = useRef<string | null>(null)
    const { playPaymentSound, playAlertOnce, stopAlertLoop } = useOrderSounds();
    const ordersRef = useRef<Record<string, OrderProps>>({});
    const fetchingRef = useRef<boolean>(false);
    const authFailedRef = useRef<boolean>(false);
    const pollingIntervalRef = useRef(3000)
    const pendingOrdersRef = useRef<Record<string, { order: OrderProps; showAt: number }>>({});
    const announcedOrdersRef = useRef<Set<string>>(new Set());
    const paidOrdersRef = useRef<Set<string>>(new Set());

    const params = useParams();
    const pathname = usePathname();
    const { user } = useAuth();
    const restaurantId = (params.restaurantId) as string;
    const { data: cooker } = useCooker(restaurantId);

    const segments = pathname.split("/").filter(Boolean);
    const isOrderPage = Boolean(restaurantId) && segments.length === 2;
    const shouldShowIosOnboarding = isIosDevice() && !isStandalone;
    const shouldBlockPermission = pushPermission === "denied" || shouldShowIosOnboarding;
    const showInstallButton = Boolean(installPromptEvent) && !isStandalone;

    const showNewOrderBanner = useCallback((orderId: string, title: string, body: string) => {
        setActiveBanner({
            orderId,
            type: "new_order",
            title,
            body,
        });
        setNavbarStatus("sent");
        playAlertOnce();
    }, [playAlertOnce]);

    const showPaymentBanner = useCallback((orderId: string, title: string, body: string) => {
        setActiveBanner({
            orderId,
            type: "payment_verified",
            title,
            body,
        });
        playPaymentSound();
    }, [playPaymentSound]);

    const announceNewOrder = useCallback((order: OrderProps, fallbackTitle = "NEW ORDER") => {
        if (announcedOrdersRef.current.has(order.orderId)) return;

        announcedOrdersRef.current.add(order.orderId);
        const summary = order.orderMenus
            .slice(0, 2)
            .map((item) => `${item.menuName} x${item.quantity}`)
            .join(", ");

        showNewOrderBanner(order.orderId, fallbackTitle, summary || "New incoming order");
    }, [showNewOrderBanner]);

    const announcePayment = useCallback((order: OrderProps, fallbackTitle = "PAYMENT VERIFIED") => {
        if (paidOrdersRef.current.has(order.orderId)) return;

        paidOrdersRef.current.add(order.orderId);
        showPaymentBanner(order.orderId, fallbackTitle, "ชำระเงินแล้ว");
    }, [showPaymentBanner]);

    const fetchInitialOrders = useCallback(async () => {
        try {
            const response = await api.get(`/order/today/${restaurantId}`);
            const data = response.data;

            const mapped: Record<string, OrderProps> = {};

            for (const order of data.orders) {
                mapped[order.orderId] = order;
            }

            announcedOrdersRef.current = new Set(
                data.orders
                    .filter((order: OrderProps) => order.status === OrderStatus.sent)
                    .map((order: OrderProps) => order.orderId)
            );
            paidOrdersRef.current = new Set(
                data.orders
                    .filter((order: OrderProps) => order.paymentStatus === "paid")
                    .map((order: OrderProps) => order.orderId)
            );

            setOrders(mapped);

            if (data.latestTimestamp) lastTimestampRef.current = data.latestTimestamp;

            setIsLoading(false);
        } catch (error: unknown) {
            if (isUnauthorizedError(error)) {
                authFailedRef.current = true;
                return;
            }
            throw error;
        }
    }, [restaurantId]);

    const fetchNewOrders = useCallback(async () => {
        if (fetchingRef.current || authFailedRef.current) return
        fetchingRef.current = true;

        try {
            const url = lastTimestampRef.current
                ? `/order/new/${restaurantId}?after=${lastTimestampRef.current}`
                : `/order/new/${restaurantId}`;
            const response = await api.get(url)
            const data = response.data

            if (data.latestTimestamp) lastTimestampRef.current = data.latestTimestamp;

            if (!data.orders || data.orders.length === 0) {
                pollingIntervalRef.current = Math.min(pollingIntervalRef.current + 1000, 8000);
            } else {
                pollingIntervalRef.current = 3000;
                const currentTime = Date.now()

                for (const order of data.orders) {
                    const existingOrder = ordersRef.current[order.orderId];

                    if (existingOrder) {
                        const justPaid = order.paymentStatus === "paid" && existingOrder.paymentStatus !== "paid"

                        setOrders(prev => ({
                            ...prev,
                            [order.orderId]: { ...prev[order.orderId], ...order }
                        }));

                        if (justPaid) announcePayment({ ...existingOrder, ...order });
                    } else if (!pendingOrdersRef.current[order.orderId]) {
                        const delayMs = 1000 + Math.random() * 2000;
                        pendingOrdersRef.current[order.orderId] = {
                            order,
                            showAt: currentTime + delayMs,
                        };
                    } else {
                        pendingOrdersRef.current[order.orderId].order = order;
                    }
                }
            }

            const currentTime = Date.now();
            const cutoff = currentTime - 10000;
            const ready: { id: string; order: OrderProps }[] = [];

            for (const [id, value] of Object.entries(pendingOrdersRef.current)) {
                if (currentTime >= value.showAt || value.showAt < cutoff) {
                    ready.push({ id, order: value.order });
                }
            }

            if (ready.length > 0) {
                setOrders(prev => {
                    const next = { ...prev };

                    for (const { id, order } of ready) {
                        next[id] = order;
                        delete pendingOrdersRef.current[id]
                    }

                    return next;
                });

                for (const { order } of ready) {
                    announceNewOrder(order);
                }
            }
        } catch (error: unknown) {
            if (isUnauthorizedError(error)) {
                authFailedRef.current = true;
            }
        } finally {
            fetchingRef.current = false
        }
    }, [announceNewOrder, announcePayment, restaurantId]);

    const syncPushToken = useCallback(async () => {
        if (!user || user.role !== "cooker") return;
        if (shouldShowIosOnboarding) {
            setPushSyncState("idle");
            return;
        }
        if (getNotificationPermission() !== "granted") return;

        try {
            setPushSyncState("syncing");
            setPushErrorMessage(null);
            setPushDebugMessage(null);
            const result = await syncCookerPushToken();

            if (result.status === "registered") {
                setPushSyncState("ready");
                setPushDebugMessage(`Push token registered on attempt ${result.attempts}.`);
                return;
            }

            setPushSyncState("error");
            setPushErrorMessage(result.errorMessage);
            setPushDebugMessage(
                result.errorCode
                    ? `Reason: ${result.errorCode}. Attempts: ${result.attempts}.`
                    : `Attempts: ${result.attempts}.`
            );
        } catch (error) {
            setPushSyncState("error");
            setPushErrorMessage("Notification token registration failed. Please try again.");
            if (error instanceof Error) {
                setPushDebugMessage(error.message);
            }
        }
    }, [shouldShowIosOnboarding, user]);

    const handleTextMode = () => {
        const newValue = !isLargeTextMode
        setIsLargeTextMode(newValue);
        localStorage.setItem("cook_large_text", JSON.stringify(newValue))
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
            if (typeof error === "object" && error !== null && "response" in error) {
                const err = error as { response: { data?: { message?: string } } };
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

            if (activeBanner?.orderId === orderId) {
                stopAlertLoop();
                setActiveBanner(null);
            }

            toastSuccess(response.data.message);

        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "response" in error) {
                const err = error as { response: { data?: { message?: string } } };
                const backendMessage = err.response.data?.message;

                setOrders(prev => ({
                    ...prev,
                    [orderId]: previousOrder,
                }));

                toastDanger(backendMessage ?? `อัพเดทสถานะออเดอร์เป็น${status}ล้มเหลว`);
            }
        }
    };

    const handleNotificationEnable = useCallback(async () => {
        if (shouldShowIosOnboarding) {
            setPushErrorMessage("ติดตั้งแอปนี้ลงบนหน้าจอโทรศัพท์ก่อน จากนั้นกดเปิดจากไอคอน และกดอนุญาตการแจ้งเตือน");
            setPushDebugMessage(null);
            return;
        }

        const permission = await requestNotificationPermission();
        setPushPermission(permission);

        if (permission === "granted") {
            await syncPushToken();
            return;
        }

        if (permission === "denied") {
            setPushErrorMessage("จำเป็นต้องเปิดการแจ้งเตือน เพื่อเปิดการแจ้งเตือนแม้ในขณะล็อกหน้าจอหรือใช้งานแอปอื่นอยู่");
            setPushDebugMessage("การอนุญาติถูกปฏิเสธ");
        }
    }, [shouldShowIosOnboarding, syncPushToken]);

    const handleInstallApp = useCallback(async () => {
        if (!installPromptEvent) return;

        await installPromptEvent.prompt();
        const result = await installPromptEvent.userChoice;
        if (result.outcome === "accepted") {
            setInstallPromptEvent(null);
        }
    }, [installPromptEvent]);

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
            if (!isMounted || authFailedRef.current) return;

            if (!document.hidden && restaurantId) await fetchNewOrdersRef.current();
            if (isMounted && !authFailedRef.current) timeoutId = setTimeout(loop, pollingIntervalRef.current);
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
            if (!document.hidden && isOrderPage && !authFailedRef.current) {
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
            localStorage.setItem("cook_order_rules_seen", "true")
        }
    }, [])

    useEffect(() => {
        setPushPermission(getNotificationPermission());
        setIsStandalone(isStandaloneMode());

        void registerNotificationServiceWorker();

        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setInstallPromptEvent(event as BeforeInstallPromptEvent);
        };

        const handleAppInstalled = () => {
            setInstallPromptEvent(null);
            setIsStandalone(true);
        };

        const handleServiceWorkerMessage = (event: MessageEvent<ServiceWorkerMessage>) => {
            const type = event.data?.type;
            const payloadData = event.data?.data;

            if (type === "BACKGROUND_ORDER_RECEIVED") {
                const orderId = payloadData?.orderId;
                if (orderId) {
                    announcedOrdersRef.current.add(orderId);
                    showNewOrderBanner(orderId, "NEW ORDER", "New order received in background!");
                    void fetchNewOrdersRef.current();
                }
                return;
            }

            if (type !== "notification-click") return;

            const clickedOrderId = payloadData?.orderId;
            if (clickedOrderId && payloadData?.type === "new_order") {
                announcedOrdersRef.current.add(clickedOrderId);
                showNewOrderBanner(clickedOrderId, "NEW ORDER", "Open order and accept it to stop reminders.");
            }

            void fetchNewOrdersRef.current();
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);
        navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
            navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
        };
    }, [showNewOrderBanner]);

    useEffect(() => {
        if (!user || user.role !== "cooker") return;
        if (pushPermission !== "granted") return;

        void syncPushToken();
    }, [pushPermission, syncPushToken, user]);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const attach = async () => {
            unsubscribe = await subscribeToForegroundMessages((payload) => {
                const banner = normalizePushPayload(payload);
                if (!banner) return;

                if (banner.type === "new_order") {
                    announcedOrdersRef.current.add(banner.orderId);
                    showNewOrderBanner(banner.orderId, banner.title, banner.body);
                } else {
                    paidOrdersRef.current.add(banner.orderId);
                    showPaymentBanner(banner.orderId, banner.title, banner.body);
                }

                void fetchNewOrdersRef.current();
            });
        };

        void attach();

        return () => {
            unsubscribe?.();
        };
    }, [showNewOrderBanner, showPaymentBanner]);

    useEffect(() => {
        if (!activeBanner || activeBanner.type !== "new_order") return;

        const activeOrder = orders[activeBanner.orderId];
        if (!activeOrder) return;
        if (activeOrder.status === OrderStatus.sent) return;

        stopAlertLoop();
        setActiveBanner(current => current?.orderId === activeBanner.orderId ? null : current);
    }, [activeBanner, orders, stopAlertLoop]);

    useEffect(() => {
        return () => {
            stopAlertLoop();
        };
    }, [stopAlertLoop]);

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

        if (navbarStatus === "completed" || navbarStatus === "cancelled_group") {
            return filtered.sort((a, b) => new Date(b.orderAt).getTime() - new Date(a.orderAt).getTime());
        }

        return filtered.sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime());
    }, [navbarStatus, filterDailyOrders, navToStatusMap]);

    if (isLoading) return <LoadingPage />
    if (!cooker) return null;

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

            <div className="flex flex-col justify-between">
                <Button
                    variant="secondary"
                    size={isLargeTextMode ? "lg" : "md"}
                    type="button"
                    onClick={handleTextMode}
                    className="px-4 py-2 rounded-lg bg-primary-light text-sm font-semibold "
                >
                    {isLargeTextMode ? "โหมดตัวอักษรปกติ" : "โหมดตัวอักษรใหญ่"}
                </Button>

                {showInstallButton && (
                    <Button
                        type="button"
                        variant="tertiary"
                        size={isLargeTextMode ? "lg" : "md"}
                        onClick={handleInstallApp}
                        className="px-4 py-2"
                    >
                        ติดตั้งแอพลิเคชัน
                    </Button>
                )}
            </div>

            {shouldBlockPermission && (
                <section className="rounded-2xl border border-danger-main bg-danger-light px-5 py-4 text-danger-main">
                    <h2 className={`${isLargeTextMode ? "text-2xl" : "text-xl"} font-bold`}>
                        จำเป็นต้องเปิดการแจ้งเตือนเพื่อให้มีการแจ้งเตือนออเดอร์ใหม่ แม้ขณะเปิดแอปอื่น ปิดเบราว์เซอร์ หรือหน้าจอโทรศัพท์ล็อกอยู่
                    </h2>
                    
                    <InstallGuideModal isIOS={isIosDevice()} isLargeTextMode={isLargeTextMode} />

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" variant="danger" size={isLargeTextMode ? "lg" : "md"} onClick={handleNotificationEnable}>
                            เปิดการแจ้งเตือน
                        </Button>
                        {pushErrorMessage && (
                            <p className={`${isLargeTextMode ? "text-base" : "text-sm"} text-danger-main`}>{pushErrorMessage}</p>
                        )}
                        {pushDebugMessage && (
                            <p className={`${isLargeTextMode ? "text-base" : "text-sm"} text-danger-main/80`}>{pushDebugMessage}</p>
                        )}
                    </div>
                </section>
            )}

            {!shouldBlockPermission && pushPermission !== "granted" && (
                <section className="rounded-2xl border border-primary-main bg-primary-light px-5 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className={`${isLargeTextMode ? "text-2xl" : "text-xl"} font-bold text-primary-main`}>
                                เปิดการแจ้งเตือน
                            </h2>
                            <p className={`${isLargeTextMode ? "text-lg" : "text-sm"} text-secondary`}>
                                จำเป็นต้องเปิดการแจ้งเตือนเพื่อให้มีการแจ้งเตือนออเดอร์ใหม่ แม้ขณะเปิดแอปอื่น ปิดเบราว์เซอร์ หรือหน้าจอโทรศัพท์ล็อกอยู่
                            </p>
                        </div>

                        <Button type="button" variant="primary" size={isLargeTextMode ? "lg" : "md"} onClick={handleNotificationEnable}>
                            {pushSyncState === "error" ? "ลองเปิดการแจ้งเตือนใหม่" : "เปิดการแจ้งเตือน"}
                        </Button>
                    </div>
                </section>
            )}

            {pushSyncState === "error" && pushErrorMessage && !shouldBlockPermission && (
                <section className="rounded-2xl border border-danger-main bg-danger-light px-5 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <p className={`${isLargeTextMode ? "text-lg" : "text-base"} font-semibold text-danger-main`}>
                                พบข้อผิดพลาด: {pushErrorMessage}
                            </p>
                            {pushDebugMessage && (
                                <p className={`${isLargeTextMode ? "text-base" : "text-sm"} text-danger-main/80`}>
                                    {pushDebugMessage}
                                </p>
                            )}
                        </div>

                        <Button
                            type="button"
                            variant="danger"
                            size={isLargeTextMode ? "lg" : "md"}
                            onClick={syncPushToken}
                        >
                            ลองอีกครั้ง
                        </Button>
                    </div>
                </section>
            )}

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
            ) : ("")}

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
                    
                    กรุณาตรวจสอบออเดอร์และดำเนินการให้ทันเวลา`}
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
