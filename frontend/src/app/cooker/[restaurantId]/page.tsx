"use client";

import CookerHeader from "@/components/cookers/Header";
import { Order, OrderProps } from "@/components/cookers/Order";
import { OrderNavBar, OrderStatus } from "@/components/cookers/OrderNavbar";
import { CookerProvider, useCooker } from "@/context/Cookercontext";
import { api } from "@/lib/api";
import { getParamId } from "@/util/param";
import { getDateFormat, getTimeFormat } from "@/util/time";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

function Page() {
    const [weeklyOrders, setWeeklyOrders] = useState<OrderProps[]>([]);
    const { cooker, fetchOrders, orders } = useCooker();
    const [_order, setOrder] = useState<OrderProps>();
    const [navbarStatus, setNavbarStatus] = useState<OrderStatus>(OrderStatus.receive);
    const params = useParams();
    const restaurantId = getParamId(params[0]);
    
    useEffect(() => {
        const fetchData = async () => {
            const response = await api.get(`/order/weekly/${cooker.restaurantId}`);
            setWeeklyOrders(response.data);
        }
        fetchData();
    }, [cooker.restaurantId, orders]);

    const weeklyDone = useMemo(() => {
        return weeklyOrders.filter((order) => order.status === OrderStatus.done);
    }, [weeklyOrders]);

    const weeklySales = useMemo(() => {
        return weeklyOrders.reduce((total, order) => total += order.totalAmount, 0);
    }, [weeklyOrders]);

    const handleOrderUpdate = (updatedOrder: OrderProps) => {
        setOrder(updatedOrder);
        fetchOrders();
    };

    const handleNavbarChange = (status: OrderStatus) => {
        setNavbarStatus(status);
    };

    const filterOrderStatus: OrderProps[] = useMemo(() => {
        return orders.filter(order => order.status === navbarStatus);
    }, [navbarStatus, orders]);

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <CookerHeader
                restaurantId={cooker.restaurantId}
                name={cooker.name}
                email={cooker?.email}
                openTime={cooker?.openTime}
                closeTime={cooker?.closeTime}
            />

            <OrderNavBar
                status={navbarStatus}
                onStatusUpdate={handleNavbarChange}
            />

            {navbarStatus === OrderStatus.done ? (
                <section className="flex flex-col gap-y-4">
                    <h1 className="noto-sans-bold text-xl text-primary">สรุปรายสัปดาห์</h1>
                    <div className="flex justify-between items-center">
                        <h2 className="noto-sans-bold text-lg text-primary">ยอดรวม: {weeklySales}</h2>
                        <p className="text-secondary noto-sans-regular text-lg">จำนวนออเดอร์: {weeklyDone.length}</p>
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