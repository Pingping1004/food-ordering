"use client";

import CookerHeader from "@/components/cookers/Header";
import { Order, OrderProps } from "@/components/cookers/Order";
import { OrderNavBar, OrderStatus } from "@/components/cookers/OrderNavbar";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/Button";
import { CookerProvider, useCooker } from "@/context/Cookercontext";
import { api } from "@/lib/api";
import { getDateFormat, getTimeFormat } from "@/util/time";
import Image from "next/image";
import { useState, useEffect, useMemo, useRef } from "react";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";
import Modal from "@/components/users/Modal";

function Page() {
    const [isLargeTextMode, setIsLargeTextMode] = useState(false)
    const [orders, setOrders] = useState<Record<string, OrderProps>>({});
    const lastTimestampRef = useRef<string | null>(null)
    const { cooker } = useCooker();
    const [navbarStatus, setNavbarStatus] = useState<OrderStatus>(OrderStatus.sent);
    const [showAutoCancelModal, setShowAutoCancelModal] = useState(false)
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [now, setNow] = useState(new Date());

    const fetchingRef = useRef(false);
    const fetchNewOrders = async () => {
        if (fetchingRef.current) return fetchingRef.current = true

        try {
            const params = new URLSearchParams()

            if (lastTimestampRef.current) params.append("after", lastTimestampRef.current)

            const url = `/order/new/${cooker.restaurantId}` + (params.toString() ? `?${params.toString()}` : "");
            const response = await api.get(url)
            const data = response.data

            if (data.orders.length > 0) {
                setOrders(prev => {
                    const next = { ...prev }

                    for (const order of data.orders) {
                        next[order.orderId] = order
                    }

                    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    for (const id in next) {
                        if (new Date(next[id].orderAt).getTime() < cutoff) delete next[id]
                    }

                    return next
                });

                if (data.latestTimestamp) lastTimestampRef.current = data.latestTimestamp
            }
        } finally {
            setIsLoading(false)
            fetchingRef.current = false
        }
    }

    const handleTextMode = () => {
        const newValue = !isLargeTextMode
        setIsLargeTextMode(newValue);
        localStorage.setItem("large_text_mode", JSON.stringify(newValue))
    }

    const handleDelayOrder = async (orderId: string) => {
        try {
            const response = await api.patch(`/order/delay/${orderId}`, { isDelay: true });
            const updatedOrder = response.data.result;

            setOrders(prev => ({ ...prev, [orderId]: updatedOrder }))
            toastSuccess(response.data.message)
        } catch (error) {
            console.error("Update order delay error: ", error)
            toastDanger(`แจ้งส่งออเดอร์ล่าช้าล้มเหลว`);
        }
    }

    const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
        try {

            let endpoint = "";

            switch (status) {
                case "accepted":
                    endpoint = `/order/accept/${orderId}`;
                    break;

                case "rejected":
                    endpoint = `/order/reject/${orderId}`;
                    break;

                case "cancelled":
                    endpoint = `/order/cancel/${orderId}`;
                    break;

                case "completed":
                    endpoint = `/order/complete/${orderId}`;
                    break;

                default:
                    throw new Error("Invalid status update");
            }

            const response = await api.patch(endpoint);

            const updatedOrder = response.data.result;

            setOrders(prev => ({
                ...prev,
                [orderId]: updatedOrder
            }));

            toastSuccess(response.data.message);

        } catch (error) {
            console.error("Update order status error:", error);
            toastDanger("อัพเดทสถานะออเดอร์ล้มเหลว");
        }
    };

    useEffect(() => {
        const saved = localStorage.getItem("cook_large_text");

        if (saved) {
            setIsLargeTextMode(JSON.parse(saved));
        }

    }, []);

    useEffect(() => {
        if (!cooker.restaurantId) return
        fetchNewOrders();

        const interval = setInterval(() => { fetchNewOrders() }, 15000)
        return () => clearInterval(interval)
    }, [cooker.restaurantId])

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const seen = localStorage.getItem("cook_order_rules_seen")

        if (!seen) {
            setShowAutoCancelModal(true)
            localStorage.setItem("cook_order_rules_seen", "true")
        }
    }, [])

    const ordersArray = useMemo(() => Object.values(orders), [orders])
    const filterDailyOrders = useMemo(() => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        return ordersArray.filter((order) => order.paymentStatus === "paid" && order.completedAt && order.completedAt >= yesterday);
    }, [ordersArray]);

    const dailyDone = useMemo(() => {
        return ordersArray.filter((order) => (order.status === OrderStatus.completed && order.completedAt)).length;
    }, [filterDailyOrders]);

    const dailySales = useMemo(() => {
        return ordersArray.filter((order) => order.paymentStatus === "paid" && order.status === OrderStatus.completed && order.completedAt)
            .reduce((total, order) => total + Number(order.totalAmount), 0);
    }, [ordersArray]);

    const handleNavbarChange = (status: OrderStatus) => {
        setNavbarStatus(status);
    };

    const isButtonDisabled = (orderAt: Date, bufferMins: number): boolean => {
        const elapsedMs = now.getTime() - new Date(orderAt).getTime();
        const elapsedMins = elapsedMs / 1000 / 60;

        return elapsedMins > bufferMins;
    }

    const filterOrderStatus: OrderProps[] = useMemo(() => {
        return ordersArray.filter(order => order.status === navbarStatus)
            .sort((a, b) => new Date(a.deliverAt).getTime() - new Date(b.deliverAt).getTime());
    }, [navbarStatus, ordersArray]);

    if (!cooker.isApproved) {
        return (
            <div className="flex flex-col w-full h-screen justify-center text-center items-center gap-y-10">
                <Image
                    src="/processing.svg"
                    alt="Processing icon"
                    priority
                    width={300}
                    height={300}
                />
                <p className="noto-sans-regular text-secondary text-xl px-10">ทางแอดมินกำลังดำเนินพิจารณาการอนุมัติเปิดร้านอาหาร ใช้เวลา 1-2วัน</p>
            </div>
        )
    }

    if (isLoading) return <LoadingPage />

    return (
        <div
            className={`flex flex-col py-10 px-6 transition-all duration-200
            ${isLargeTextMode ? "gap-y-14 text-lg" : "gap-y-10 text-base"}`}
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

            {navbarStatus === OrderStatus.completed ? (
                <section className="flex flex-col gap-y-6">
                    <h1 className={`${isLargeTextMode ? "text-3xl" : "text-2xl"} font-bold text-primary`}>สรุปรายวัน</h1>
                    <div className="flex justify-between items-center">
                        <h2 className={`${isLargeTextMode ? "text-2xl" : "text-xl"} font-bold text-primary`}>ยอดขายรวม: {dailySales}</h2>

                        <p className={`${isLargeTextMode ? "text-2xl" : "text-xl"} text-secondary`}>ออเดอร์วันนี้: {dailyDone}</p>
                    </div>
                </section>
            ) : ('')}
            {/* {!isUpdateMode ? (
                <section className="grid grid-cols-2 gap-4">
                    <Button
                        variant="danger"
                        type="button"
                        size="md"
                        className="flex items-center justify-between"
                        iconPosition="start"
                        numberIcon={2}
                        onClick={() => router.push("/issued-orders")}
                    >
                        ออเดอร์ที่มีปัญหา
                    </Button>

                    <Button
                        variant="secondary"
                        size="md"
                        className="flex items-center justify-between"
                        onClick={handleUpdateClick} // Trigger update mode
                        type={"button"}                    >
                        อัพเดทหลายออเดอร์
                    </Button>
                </section>
            ) : (
                <Button
                    variant="primary"
                    size="full"
                    type="button"
                    className="flex items-center justify-center"
                    onClick={handleCompleteClick} // Complete update mode
                >
                    <div className="flex gap-x-2 noto-sans-bold text-sm">
                        <span>({selectedCount})</span>
                        <span>อัพเดทสถานะ</span>
                    </div>
                </Button>
            )} */}
            <main>
                {filterOrderStatus.map((order) => (
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
                        isDelayDisabled={isButtonDisabled(new Date(order.orderAt), 10)}
                        isCancelledDisabled={isButtonDisabled(new Date(order.orderAt), 5)}
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