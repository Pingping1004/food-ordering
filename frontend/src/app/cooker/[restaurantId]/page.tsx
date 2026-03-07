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

function Page() {
    const [isLargeTextMode, setIsLargeTextMode] = useState(false)
    const [orders, setOrders] = useState<OrderProps[]>([]);
    const lastTimestampRef = useRef<string | null>(null)
    const { cooker, fetchOrders } = useCooker();
    const [navbarStatus, setNavbarStatus] = useState<OrderStatus>(OrderStatus.accepted);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const fetchNewOrders = async () => {
        try {
            const params = new URLSearchParams()

            if (lastTimestampRef.current) {
                params.append("after", lastTimestampRef.current)
            }

            const url = `/order/new/${cooker.restaurantId}` + (params.toString() ? `?${params.toString()}` : "");
            const response = await api.get(url)
            const data = response.data

            if (data.orders.length > 0) {
                setOrders(prev => {
                    const existing = new Set(prev.map(order => order.orderId));
                    const newOrders = data.orders.filter((order: OrderProps) => !existing.has(order.orderId));

                    return [...prev, ...newOrders]
                });

                lastTimestampRef.current = data.latestTimestamp
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleTextMode = () => {
        const newValue = !isLargeTextMode
        setIsLargeTextMode(newValue);
        localStorage.setItem("large_text_mode", JSON.stringify(newValue))
    }

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

    const filterWeeklyOrders = useMemo(() => {
        return orders.filter((order) => order.isPaid === "paid");
    }, [orders]);

    const weeklyDone = useMemo(() => {
        return filterWeeklyOrders.filter((order) => (order.status === OrderStatus.accepted)).length;
    }, [filterWeeklyOrders]);

    const weeklySales = useMemo(() => {
        return orders
            .filter((order) => order.isPaid === "paid" && order.status === OrderStatus.accepted)
            .reduce((total, order) => total + Number(order.totalAmount), 0);
    }, [filterWeeklyOrders]);

    const handleOrderUpdate = (updatedOrder: OrderProps) => {
        setOrders(prev =>
            prev.map(order => order.orderId === updatedOrder.orderId ? updatedOrder : order)
        );

        fetchOrders();
    };

    const handleNavbarChange = (status: OrderStatus) => {
        setNavbarStatus(status);
    };

    const filterOrderStatus: OrderProps[] = useMemo(() => {
        return orders.filter(order => order.status === navbarStatus);
    }, [navbarStatus, orders]);

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
                onStatusUpdate={handleNavbarChange}
            />

            {navbarStatus === OrderStatus.accepted ? (
                <section className="flex flex-col gap-y-6">
                    <h1 className={`${isLargeTextMode ? "text-3xl" : "text-2xl"} font-bold text-primary`}>สรุปรายสัปดาห์</h1>
                    <div className="flex justify-between items-center">
                        <h2 className={`${isLargeTextMode ? "text-2xl" : "text-lg"} font-bold text-primary`}>ยอดรวม: {weeklySales}</h2>

                        <p className={`${isLargeTextMode ? "text-xl" : "text-lg"} text-secondary`}>ออเดอร์สัปดาห์นี้: {weeklyDone}</p>
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
                        isPaid={order.isPaid}
                        orderMenus={order.orderMenus}
                        details={order.details}
                        userTel={order.userTel}
                        isLargeTextMode={isLargeTextMode}
                        className="mb-4"
                        selected="default"
                        onDelayUpdate={handleOrderUpdate}
                        onStatusUpdate={handleOrderUpdate}
                    />
                ))}
            </main>
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