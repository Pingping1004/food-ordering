"use client";

import { Button } from "@/components/Button";
import CookerHeader from "@/components/cookers/Header";
import { Order, OrderProps } from "@/components/cookers/Order";
import { OrderNavBar } from "@/components/cookers/OrderNavbar";
import { OrderType } from "@/components/users/OrderList";
import { CookerProvider, useCooker } from "@/context/Cookercontext";
import { getDateFormat, getTimeFormat } from "@/util/time";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

function Page() {
    const router = useRouter();
    const { cooker, fetchOrders, orders, setOrders, loading, error } = useCooker();
    const [order, setOrder] = useState<OrderProps>();
    const [orderState, setOrderState] = useState<"receive" | "cooking" | "ready" | "done">();

    // const [isUpdateMode, setIsUpdateMode] = useState(false); // State to toggle update mode
    // const [selectedCount, setSelectedCount] = useState(0); // State to track selected orders

    const handleOrderUpdate = (updatedOrder: OrderProps) => {
        setOrder(updatedOrder);
        fetchOrders();
    };

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <CookerHeader
                restaurantId={cooker.restaurantId}
                name={cooker.name}
                email={cooker?.email}
                openTime={cooker?.openTime}
                closeTime={cooker?.closeTime}
            />
            <OrderNavBar onClick={() => router.push("/")} />
            {orderState === "done" ? (
                <h3 className="noto-sans-bold text-base">ออเดอร์ที่มีปัญหา</h3>
            ) : ""}
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
                {orders.map((order) => (
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