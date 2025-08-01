"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "../Button";
import { cva, VariantProps } from "class-variance-authority";
import clsx from "clsx";
import { api } from "@/lib/api";
import { getTimeFormat } from "@/util/time";
import { OrderStatus } from "./OrderNavbar";

const orderVariants = cva("noto-sans-regular justify-center text-sm", {
    variants: {
        variant: {
            receive: "",
            cooking: "",
            ready: "",
            done: "",
        },
        isPaid: {
            paid: "",
            unpaid: "",
            processing: "",
            rejected: "",
        },
        selected: {
            default: "",
            true: "",
            false: "",
        },
        isDelayProp: {
            true: "",
            false: "",
        }
    },
    defaultVariants: {
        variant: "receive",
        isPaid: "unpaid",
        selected: "default",
        isDelayProp: false,
    },
});

export type OrderProps = React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof orderVariants> & {
        orderId: string;
        orderAt: string;
        deliverAt: string;
        status: OrderStatus;
        selected: "default" | boolean;
        totalAmount: number;
        isPaid: "paid" | "unpaid" | "processing" | "rejected";
        isDelay: boolean;
        orderMenus: { quantity: number; menuName: string; menuImg?: string }[];
        details?: string;
        userTel: string;
        onDelayUpdate: (updateOrder: OrderProps) => void;
        onStatusUpdate: (updateStatus: OrderProps) => void;
    };

const getOrderStatusProps = (currentStatus: OrderStatus) => {
    switch (currentStatus) {
        case OrderStatus.receive:
            return { text: 'เริ่มปรุงอาหาร', nextStatus: OrderStatus.cooking };
        case OrderStatus.cooking:
            return { text: 'พร้อมเสิร์ฟ', nextStatus: OrderStatus.ready };
        case OrderStatus.ready:
            return { text: 'เสร็จสิ้น', nextStatus: OrderStatus.done }; // Text for marking as done
        case OrderStatus.done:
            return { text: 'ออเดอร์เสร็จสิ้น' }; // Text for marking as done
        default: // Should ideally not be hit
            return { text: 'สถานะไม่ทราบ', nextStatus: currentStatus };
    }
};

export const Order = ({
    orderId,
    variant,
    selected = "default",
    orderAt,
    userTel,
    status,
    deliverAt,
    totalAmount,
    isPaid,
    isDelay = false,
    orderMenus = [],
    className,
    onDelayUpdate,
    onStatusUpdate,
    ...props
}: OrderProps) => {
    const [, setCurrentStatus] = useState(status);
    const [isDelayed, setIsDelayed] = useState(isDelay);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        setCurrentStatus(status);
        setIsDelayed(isDelay);
    }, [status, isDelay]);

    const handleDelayOrder = async () => {
        if (isUpdating) return;
        setIsUpdating(true);

        try {
            const response = await api.patch(`/order/delay/${orderId}`, {
                // delayDuration: 10,
                isDelay: true,
            });
            const updatedOrderFromServer = response.data;

            // Update local state for immediate feedback in this component
            setIsDelayed(updatedOrderFromServer.isDelayed || true);

            // IMPORTANT: Call the callback to update the parent's state
            onDelayUpdate(updatedOrderFromServer);

            alert(`เลื่อนเวลาจัดส่งออเดอร์ไป10นาทีสำเร็จ!`);

        } catch {
            alert(`เลื่อนเวลาจัดส่งออเดอร์ล้มเหลว`);
        } finally {
            setIsUpdating(false);
        }
    }

    const handleUpdateStatus = async (orderId: string) => {
        setIsUpdating(true);
        try {
            const { nextStatus } = getOrderStatusProps(status);

            if (isPaid === 'unpaid' && (status === "ready" || nextStatus === OrderStatus.done)) {
                alert('ไม่สามารถจบออเดอร์ได้ หากยังไม่ชำระเงิน');
                return;
            }

            const response = await api.patch(`/order/update-status/${orderId}`);

            const updatedOrder = response.data.result;
            setCurrentStatus(updatedOrder.status);
            onStatusUpdate(updatedOrder.status);
        } catch {
            alert(`แจ้งออเกอร์ล่าช้าล้มเหลว`);
        } finally {
            setIsUpdating(false);
        }
    }

    return (
        <div
            className={clsx(
                "flex flex-col p-4 border-1 border-[#E1E1E1] rounded-2xl gap-y-6",
                orderVariants({ variant, isPaid, selected, isDelayProp: isDelayed }),
                className
            )}
            {...props}
        >
            <header className="flex items-start justify-between">
                <div className="flex grid-rows-2 text-left gap-x-2">
                    {selected === true && (
                        <Image
                            src="/selected.svg"
                            alt="Selected orders"
                            width={18}
                            height={18}
                        />
                    )}

                    {selected === false && (
                        <Image
                            src="/non-select.svg"
                            alt="Non-selected orders"
                            width={18}
                            height={18}
                        />
                    )}

                    <div className="flex flex-col gap-y-1">
                        <div className="flex justify-center gap-x-2">
                            <h3 className="noto-sans-bold text-lg text-primary">
                                {orderId?.substring(0, 4)}
                            </h3>

                            <p className="flex items-center noto-sans-bold text-sm text-secondary">
                                (<span className="mr-1">เบอร์ติดต่อ:</span>
                                <a
                                    href={`tel:${userTel}`}
                                    className="text-info underline hover:text-info"
                                >
                                    {userTel}
                                </a>
                                <span>{')'}</span>
                            </p>
                        </div>
                        <p className="noto-sans-regular text-light text-sm">สั่งเมื่อ {orderAt}</p>
                    </div>
                </div>

                <Button
                    variant={isPaid === 'paid' ? "secondarySuccess" : "secondaryDanger"}
                    size="sm"
                    type="button"
                >
                    {isPaid === 'paid' ? "ชำระแล้ว" : "ยังไม่ชำระ"}
                </Button>
            </header>

            <main className="flex grid-rows-2 justify-between">
                <div className="w-1/2 text-base text-secondary">
                    <p className="mb-2 text-primary">รายละเอียดออเดอร์:</p>
                    {orderMenus.map((item) => (
                        <p
                            key={item.menuName}
                        >{item.quantity}x - {item.menuName}</p>
                    ))}
                </div>

                <div className="flex w-1/2 grid-cols-2 items-end justify-end md:gap-x-6 gap-x-4">
                    <div className="text-center">
                        <p className="text-sm">จัดส่ง:</p>
                        <h4 className="text-base text-secondary">{getTimeFormat(deliverAt)}</h4>
                    </div>

                    <div className="text-center">
                        <p className="text-sm">ราคา:</p>
                        <h4 className="text-base text-secondary">{totalAmount}</h4>
                    </div>
                </div>
            </main>

            {/* <section>
                <p className="noto-sans-bold text-sm">{details}</p>
            </section> */}

            {status === OrderStatus.done ? (
                <Button
                    variant="secondarySuccess"
                    size="md"
                    className="flex w-full"
                    type="button"
                >
                    ออเดอร์เสร็จสิ้น
                </Button>
            ) : (
                <div className="flex gap-x-6">
                    <Button
                        variant="primary"
                        size="md"
                        className="flex w-full"
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(orderId)}
                    >
                        <span className="noto-sans-regular">
                            {getOrderStatusProps(status).text}
                        </span>
                    </Button>

                    <Button
                        variant="secondaryDanger"
                        disabled={isDelay || isUpdating}
                        size="md"
                        type="button"
                        className="flex w-full"
                        onClick={handleDelayOrder}
                    >
                        <span className="noto-sans-regular">
                            {isDelay === false ? 'แจ้งล่าช้า10นาที' : 'แจ้งล่าช้าสำเร็จ'}
                        </span>
                    </Button>
                </div>
            )}
        </div>
    )
};
