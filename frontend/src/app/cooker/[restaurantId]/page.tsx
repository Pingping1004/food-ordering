"use client"

import { useTextSize } from "@/components/TextSizeProvider";
import dynamic from "next/dynamic";
import { OrderProps } from "@/components/cookers/Order";
import { NavState, OrderStatus } from "@/components/cookers/OrderNavbar";
import { CookerBoardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";
import { getDateFormat, getTimeFormat } from "@/util/time";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toastError, toastDanger, toastSuccess } from "@/components/ui/Toast";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useOrderSounds } from "@/hook/useOrderSounds";
import { useCooker } from "@/hook/useCooker";
import { CookerShell } from "@/components/cookers/CookerShell";
import WarningBanner from "../../../components/cookers/WarningBanner";
import CookerHeader from "../../../components/cookers/CookerHeader";
import Order from "../../../components/cookers/Order";
import OrderNavBar from "../../../components/cookers/OrderNavbar";
import { todayHours } from "@/lib/schema/format";
import { useAuth } from "@/auth/auth.hooks";
import { canUseCooker } from "@/auth/access";
import {
    getNotificationPermission,
    registerNotificationServiceWorker,
    requestNotificationPermission,
    subscribeToForegroundMessages,
    syncCookerPushToken,
} from "@/lib/firebase-messaging";
import type { MessagePayload } from "firebase/messaging";

/** `Order.pickupAt` in the new schema; rows from the pre-migration API still say `deliverAt`. */
type SortKey = "pickup" | "newest" | "oldest" | "amount";
const SORT_KEY_STORAGE = "cook_order_sort";
/** Plain-language labels on purpose: the board is used by cooks of all ages. */
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "pickup", label: "ใกล้ถึงเวลารับก่อน (แนะนำ)" },
    { value: "newest", label: "สั่งเข้ามาใหม่ล่าสุดก่อน" },
    { value: "oldest", label: "สั่งเข้ามานานแล้วก่อน" },
    { value: "amount", label: "ราคามากที่สุดก่อน" },
];

const pickupOf = (o: OrderProps & { deliverAt?: string }): string => o.pickupAt ?? o.deliverAt ?? o.orderAt;

// Overlays only: lazy is fine because they take no space in the page flow. Layout pieces above are static to avoid late layout shifts.
const Modal = dynamic(() => import("../../../components/users/Modal"), { ssr: false })
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
    const { largeText: isLargeTextMode, setLargeText } = useTextSize();
    const [orders, setOrders] = useState<Record<string, OrderProps>>({});
    const [navbarStatus, setNavbarStatus] = useState<NavState>("receive");
    const [showAutoCancelModal, setShowAutoCancelModal] = useState(false)
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [now, setNow] = useState(Date.now());
    const [showRuleBanner, setShowRuleBanner] = useState(true);
    const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported" | null>(null); // null until read on mount, so no banner flashes in and out
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
    const router = useRouter();

    // Not approved by the school yet (Restaurant.status = INACTIVE) → waiting screen instead of an empty order board.
    useEffect(() => {
        if (cooker?.status === "INACTIVE") router.replace(`/cooker/pending/${restaurantId}`);
    }, [cooker?.status, restaurantId, router]);

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

        setNavbarStatus("receive");
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

    const announceNewOrder = useCallback((order: OrderProps, fallbackTitle = "ออเดอร์ใหม่") => {
        if (announcedOrdersRef.current.has(order.orderId)) return;

        announcedOrdersRef.current.add(order.orderId);
        const summary = order.orderMenus
            .slice(0, 2)
            .map((item) => `${item.menuName} x${item.quantity}`)
            .join(", ");

        showNewOrderBanner(order.orderId, fallbackTitle, summary || "New incoming order");
    }, [showNewOrderBanner]);

    const announcePayment = useCallback((order: OrderProps, fallbackTitle = "ชำระเงินแล้ว") => {
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
                    .filter((order: OrderProps) => [OrderStatus.sent, OrderStatus.receive].includes(order.status))
                    .map((order: OrderProps) => order.orderId)
            );
            paidOrdersRef.current = new Set(
                data.orders
                    .filter((order: OrderProps) => ["paid", "PAID"].includes(order.paymentStatus))
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
                        const isPaidNow = (p: string) => p.toLowerCase() === "paid";
                        const justPaid = isPaidNow(order.paymentStatus) && !isPaidNow(existingOrder.paymentStatus)

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
        if (!user || !canUseCooker(user)) return;
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
        setLargeText(!isLargeTextMode);
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
            setOrders(prev => ({
                ...prev,
                [orderId]: previousOrder,
            }));

            toastError("แจ้งออเดอร์ล่าช้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", error);
        }
    }

    const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
        const previousOrder = orders[orderId];

        // Accepting no longer changes the status (the order waits for payment); it only stamps `acceptAt`.
        const accepting = status === OrderStatus.cooking || status === OrderStatus.accepted;
        setOrders(prev => ({
            ...prev,
            [orderId]: accepting
                ? { ...prev[orderId], acceptAt: new Date() }
                : { ...prev[orderId], status },
        }));

        try {
            let endpoint = "";

            switch (status) {
                case OrderStatus.cooking:
                case OrderStatus.accepted:
                    endpoint = `/order/accept/${orderId}`; break;
                case OrderStatus.rejected:
                    endpoint = `/order/reject/${orderId}`; break;
                case OrderStatus.cancelled:
                    endpoint = `/order/cancel/${orderId}`; break;
                case OrderStatus.ready:
                    endpoint = `/order/ready/${orderId}`; break;
                case OrderStatus.done:
                case OrderStatus.completed:
                    endpoint = `/order/done/${orderId}`; break;
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
            setOrders(prev => ({
                ...prev,
                [orderId]: previousOrder,
            }));

            toastError(`เปลี่ยนสถานะออเดอร์เป็น${status}ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`, error);
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

        // A failed first load used to leave the board on its skeleton forever with no polling (an unhandled rejection).
        // Retry with backoff instead: at the lunch rush a 503 is transient.
        const init = async (attempt = 0) => {
            try {
                await fetchInitialOrders();
            } catch {
                if (isMounted) timeoutId = setTimeout(() => void init(attempt + 1), Math.min(2000 * 2 ** attempt, 15_000));
                return;
            }
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
            setLargeText(true)
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
        if (!user || !canUseCooker(user)) return;
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
        if (activeOrder.status === OrderStatus.sent || activeOrder.status === OrderStatus.receive) return;

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
        return filterDailyOrders.filter((order) => (
            [OrderStatus.completed, OrderStatus.done].includes(order.status) &&
            ["paid", "PAID"].includes(order.paymentStatus)
        )).length;
    }, [filterDailyOrders]);

    const dailyRejectAndCancelled = useMemo(() => {
        return filterDailyOrders.filter((order) => (
            [OrderStatus.rejected, OrderStatus.cancelled].includes(order.status)
        )).length;
    }, [filterDailyOrders]);

    const dailySales = useMemo(() => {
        return filterDailyOrders.filter((order) =>
            ["paid", "PAID"].includes(order.paymentStatus) &&
            [OrderStatus.completed, OrderStatus.done].includes(order.status)
        ).reduce((total, order) => total + Number(order.totalAmount), 0);
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

    // Legacy values stay mapped so rows written before the schema migration still show up.
    const navToStatusMap: Record<NavState, OrderStatus[]> = useMemo(() => ({
        receive: [OrderStatus.receive, OrderStatus.sent],
        cooking: [OrderStatus.cooking, OrderStatus.delay, OrderStatus.accepted],
        ready: [OrderStatus.ready],
        history: [OrderStatus.done, OrderStatus.completed, OrderStatus.rejected, OrderStatus.cancelled],
    }), []);

    const [sortKey, setSortKey] = useState<SortKey>("pickup");
    useEffect(() => {
        try {
            const saved = localStorage.getItem(SORT_KEY_STORAGE);
            if (SORT_OPTIONS.some((o) => o.value === saved)) setSortKey(saved as SortKey);
        } catch { /* storage blocked: keeps the default */ }
    }, []);
    const chooseSort = (value: SortKey) => {
        setSortKey(value);
        try { localStorage.setItem(SORT_KEY_STORAGE, value); } catch { /* ignore */ }
    };

    const filterTodayOrderStatus: OrderProps[] = useMemo(() => {
        const allowedStatuses = navToStatusMap[navbarStatus];
        const filtered = filterDailyOrders.filter(order => allowedStatuses.includes(order.status));
        const t = (iso: string) => new Date(iso).getTime();

        // Default: nearest pickup time on top. Finished orders have no "next pickup", so they default to newest first.
        const byPickup = navbarStatus === "history"
            ? (a: OrderProps, b: OrderProps) => t(b.orderAt) - t(a.orderAt)
            : (a: OrderProps, b: OrderProps) => t(pickupOf(a)) - t(pickupOf(b));
        const compare = {
            pickup: byPickup,
            newest: (a: OrderProps, b: OrderProps) => t(b.orderAt) - t(a.orderAt),
            oldest: (a: OrderProps, b: OrderProps) => t(a.orderAt) - t(b.orderAt),
            amount: (a: OrderProps, b: OrderProps) => Number(b.totalAmount) - Number(a.totalAmount) || byPickup(a, b),
        }[sortKey];
        return filtered.sort(compare);
    }, [navbarStatus, filterDailyOrders, navToStatusMap, sortKey]);

    if (isLoading) return <CookerBoardSkeleton />;
    if (!cooker) return null;

    const lg = isLargeTextMode;
    const tabCounts: Partial<Record<NavState, number>> = {};
    (Object.keys(navToStatusMap) as NavState[]).forEach((k) => {
        tabCounts[k] = filterDailyOrders.filter((o) => navToStatusMap[k].includes(o.status)).length;
    });
    const noticeCls = "flex flex-col gap-3 rounded-2xl px-5 py-4";

    return (
        <CookerShell restaurantId={cooker.restaurantId} active="orders">
            <CookerHeader
                restaurantId={cooker.restaurantId}
                name={cooker.name}
                openTime={cooker.openTime ?? todayHours(cooker.operatingHours)?.open ?? ""}
                closeTime={cooker.closeTime ?? todayHours(cooker.operatingHours)?.close ?? ""}
                isLargeTextMode={lg}
                right={
                    <button
                        type="button"
                        onClick={handleTextMode}
                        aria-pressed={lg}
                        className="h-12 shrink-0 rounded-xl border-[1.5px] border-line-soft bg-white px-3.5 text-sm font-semibold"
                    >
                        {lg ? "ตัวอักษรปกติ" : "ตัวอักษรใหญ่"}
                    </button>
                }
            />

            <div className={`flex flex-col gap-3 px-5 pt-4 ${lg ? "text-lg" : ""}`}>
                {showInstallButton && (
                    <Button type="button" variant="tertiary" size={lg ? "lg" : "md"} onClick={handleInstallApp}>
                        ติดตั้งแอพลิเคชัน
                    </Button>
                )}

                {shouldBlockPermission && (
                    <section className={`${noticeCls} border-2 border-danger-main bg-danger-light text-brand-dark`}>
                        <h2 className={`${lg ? "text-2xl" : "text-xl"} font-bold`}>
                            จำเป็นต้องเปิดการแจ้งเตือนเพื่อให้มีการแจ้งเตือนออเดอร์ใหม่ แม้ขณะเปิดแอปอื่น ปิดเบราว์เซอร์ หรือหน้าจอโทรศัพท์ล็อกอยู่
                        </h2>

                        <InstallGuideModal isIOS={isIosDevice()} isLargeTextMode={lg} />

                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="danger" size={lg ? "lg" : "md"} onClick={handleNotificationEnable}>
                                เปิดการแจ้งเตือน
                            </Button>
                            {pushErrorMessage && (
                                <p className={`${lg ? "text-base" : "text-sm"} font-medium text-danger-main`}>{pushErrorMessage}</p>
                            )}
                            {pushDebugMessage && (
                                <p className={`${lg ? "text-base" : "text-sm"} text-brand-muted`}>{pushDebugMessage}</p>
                            )}
                        </div>
                    </section>
                )}

                {!shouldBlockPermission && pushPermission !== null && pushPermission !== "granted" && (
                    <section className={`${noticeCls} bg-primary-light`}>
                        <div>
                            <h2 className={`${lg ? "text-2xl" : "text-xl"} font-bold text-primary-dark`}>เปิดการแจ้งเตือน</h2>
                            <p className={`${lg ? "text-lg" : "text-sm"} mt-1 text-brand-muted`}>
                                จำเป็นต้องเปิดการแจ้งเตือนเพื่อให้มีการแจ้งเตือนออเดอร์ใหม่ แม้ขณะเปิดแอปอื่น ปิดเบราว์เซอร์ หรือหน้าจอโทรศัพท์ล็อกอยู่
                            </p>
                        </div>
                        <Button type="button" variant="primary" size={lg ? "lg" : "md"} onClick={handleNotificationEnable}>
                            {pushSyncState === "error" ? "ลองเปิดการแจ้งเตือนใหม่" : "เปิดการแจ้งเตือน"}
                        </Button>
                    </section>
                )}

                {pushSyncState === "error" && pushErrorMessage && !shouldBlockPermission && (
                    <section className={`${noticeCls} border-2 border-danger-main bg-danger-light`}>
                        <p className={`${lg ? "text-lg" : "text-base"} font-semibold`}>พบข้อผิดพลาด: {pushErrorMessage}</p>
                        {pushDebugMessage && (
                            <p className={`${lg ? "text-base" : "text-sm"} text-brand-muted`}>{pushDebugMessage}</p>
                        )}
                        <Button type="button" variant="danger" size={lg ? "lg" : "md"} onClick={syncPushToken}>
                            ลองอีกครั้ง
                        </Button>
                    </section>
                )}
            </div>

            <OrderNavBar
                status={navbarStatus}
                isLargeTextMode={lg}
                counts={tabCounts}
                onStatusUpdate={handleNavbarChange}
            />

            <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
                {showRuleBanner && navbarStatus === "receive" && (
                    <WarningBanner isLargeTextMode={lg} onClose={handleCloseBanner} />
                )}

                {navbarStatus === "ready" && (
                    <p className={`${lg ? "text-xl" : "text-[17px]"} leading-normal text-slate`}>
                        อาหารเสร็จแล้ว รอนักเรียนมารับ กด <b>“นักเรียนรับแล้ว”</b> เมื่อส่งอาหารให้
                    </p>
                )}

                {navbarStatus === "history" && (
                    <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-5">
                        <h2 className={`${lg ? "text-2xl" : "text-xl"} font-bold`}>สรุปรายวัน</h2>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className={`${lg ? "text-xl" : "text-lg"} text-brand-muted`}>ออเดอร์ที่ทำเสร็จ {dailyDone}</span>
                            <span className={`${lg ? "text-[32px]" : "text-[26px]"} font-bold`}>{dailySales.toLocaleString("th-TH")} บาท</span>
                        </div>
                        <p className={`${lg ? "text-xl" : "text-lg"} text-brand-muted`}>ออเดอร์ที่ถูกยกเลิก/ปฏิเสธ: {dailyRejectAndCancelled}</p>
                    </section>
                )}

                <label className="flex flex-col gap-1.5">
                    <span className={`${lg ? "text-xl" : "text-lg"} font-semibold`}>เรียงออเดอร์ตาม</span>
                    <select value={sortKey} onChange={(e) => chooseSort(e.target.value as SortKey)}
                        className={`${lg ? "h-16 text-xl" : "h-14 text-lg"} w-full rounded-2xl border-[1.5px] border-line bg-white px-4 font-semibold md:max-w-md outline-none focus:border-primary-main`}>
                        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </label>

                <main className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] items-start gap-4">
                    {filterTodayOrderStatus.map((order) => (
                        <Order
                            key={order.orderId}
                            orderId={order.orderId}
                            totalAmount={order.totalAmount}
                            isDelay={order.isDelay}
                            status={order.status}
                            orderAt={`${getTimeFormat(order.orderAt)} ${getDateFormat(new Date(order.orderAt))}`}
                            orderCreatedAt={order.orderAt}
                            pickupAt={pickupOf(order)}
                            paymentStatus={order.paymentStatus}
                            acceptAt={order.acceptAt}
                            orderMenus={order.orderMenus}
                            details={order.details}
                            userTel={order.userTel}
                            isLargeTextMode={lg}
                            isDelayDisabled={isDelayDisabled(new Date(order.acceptAt ?? order.orderAt), new Date(pickupOf(order)))}
                            isRejectedDisabled={isRejectedDisabled(new Date(order.orderAt), new Date(pickupOf(order)))}
                            onDelayUpdate={handleDelayOrder}
                            onStatusUpdate={handleUpdateStatus}
                        />
                    ))}
                    {filterTodayOrderStatus.length === 0 && (
                        <p className={`col-span-full py-10 text-center text-brand-muted ${lg ? "text-xl" : "text-lg"}`}>ยังไม่มีออเดอร์ในหมวดนี้</p>
                    )}
                </main>
            </div>

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
        </CookerShell>
    );
}

export default function CookerHomePage() {
    return (
        <Page />
    )
}
