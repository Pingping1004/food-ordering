"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "../Button";
import { cva, VariantProps } from "class-variance-authority";
import clsx from "clsx";
import { api } from "@/lib/api";
import { getTimeFormat } from "@/util/time";
import { OrderStatus, PaymentStatus } from "./OrderNavbar";

const orderVariants = cva("noto-sans-regular justify-center text-sm", {
    variants: {
        variant: {
            sent: "",
            accepted: "",
            cancelled: "",
            completed: "",
        },
        paymentStatus: {
            paid: "",
            unpaid: "",
            verifying: "",
            refund_pending: "",
            refund_complete: "",
            failed: "",
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
        variant: "sent",
        paymentStatus: "unpaid",
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
        isDelay: boolean;
        orderMenus: { quantity: number; menuName: string; menuImg?: string }[];
        details?: string;
        userTel: string;
        isLargeTextMode?: boolean
        onDelayUpdate: (orderId: string) => void;
        onStatusUpdate: (orderId: string, status: OrderStatus) => void;
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
    paymentStatus,
    isDelay = false,
    orderMenus = [],
    className,
    isLargeTextMode = false,
    onDelayUpdate,
    onStatusUpdate,
    ...props
}: OrderProps) => {
    const [isDelayed, setIsDelayed] = useState(isDelay);
    const [isUpdating, setIsUpdating] = useState(false);

    const isRefund = variant?.startsWith('refund');

    return (
        <div
            className={clsx(
                "flex flex-col p-4 border-1 border-[#E1E1E1] rounded-2xl",
                isLargeTextMode ? "p-6 gap-y-8 text-lg" : "p-4 gap-y-6 text-sm",
                orderVariants({ variant, paymentStatus, selected, isDelayProp: isDelayed }),
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
                            <h3 className={clsx(
                                "noto-sans-bold text-lg text-primary",
                                isLargeTextMode ? "text-2xl" : "text-lg"
                            )}>
                                {orderId?.substring(0, 4)}
                            </h3>

                            <p
                                className={clsx(
                                    "flex items-center noto-sans-bold text-secondary",
                                    isLargeTextMode ? "text-base" : "text-sm"
                                )}
                            >
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
                        <p
                            className={clsx(
                                "noto-sans-regular text-light",
                                isLargeTextMode ? "text-base" : "text-sm"
                            )}
                        >
                            สั่งเมื่อ {orderAt}
                        </p>
                    </div>
                </div>

                {isRefund && (
                    <Button
                        variant={paymentStatus === 'refund_complete' ? "secondarySuccess" : "secondaryDanger"}
                        size="sm"
                        type="button"
                    >
                        {paymentStatus === 'refund_complete' ? "คืนเงินแล้ว" : "ยังไม่่คืนเงิน"}
                    </Button>
                )}
            </header>

            <main className="flex grid-rows-2 justify-between">
                <div
                    className={clsx(
                        "w-1/2 text-secondary",
                        isLargeTextMode ? "text-lg" : "text-base"
                    )}
                >
                    <p className="mb-2 text-primary">รายละเอียดออเดอร์:</p>
                    {orderMenus.map((item) => (
                        <p
                            key={item.menuName}
                            className={clsx(isLargeTextMode ? "text-xl mb-1 font-bold" : "text-base")}
                        >
                            {item.quantity}x - {item.menuName}
                        </p>
                    ))}
                </div>

                <div className="flex w-1/2 grid-cols-2 items-end justify-end md:gap-x-6 gap-x-4">
                    <div className="text-center">
                        <p className={clsx(isLargeTextMode ? "text-base" : "text-sm")}>จัดส่ง:</p>

                        <h4
                            className={clsx("text-secondary", isLargeTextMode ? "text-xl font-bold" : "text-base")}
                        >
                            {getTimeFormat(deliverAt)}
                        </h4>
                    </div>

                    <div className="text-center">
                        <p className={clsx(isLargeTextMode ? "text-base" : "text-sm")}>ราคา:</p>
                        <h4
                            className={clsx("text-secondary", isLargeTextMode ? "text-xl font-bold" : "text-base")}
                        >
                            {totalAmount}
                        </h4>
                    </div>
                </div>
            </main>

            {/* <section>
                <p className="noto-sans-bold text-sm">{details}</p>
            </section> */}

            {status === OrderStatus.completed ? (
                <Button
                    variant="secondarySuccess"
                    size={isLargeTextMode ? "lg" : "md"}
                    className="flex w-full"
                    type="button"
                >
                    ออเดอร์เสร็จสิ้น
                </Button>
            ) : (
                <div className={status === OrderStatus.sent ? "grid grid-cols-2 gap-x-2" : ""}>
                    {status === OrderStatus.sent && (
                        <>
                            <Button
                                variant="primary"
                                size={isLargeTextMode ? "lg" : "md"}
                                className="flex w-full"
                                type="button"
                                disabled={isUpdating}
                                onClick={() => onStatusUpdate(orderId, OrderStatus.accepted)}
                            >
                                <span className="noto-sans-regular">
                                    รับออเดอร์
                                </span>
                            </Button>

                            <Button
                                variant="secondaryDanger"
                                disabled={isDelay || isUpdating}
                                size={isLargeTextMode ? "lg" : "md"}
                                type="button"
                                className="flex w-full"
                                onClick={() => onStatusUpdate(orderId, OrderStatus.cancelled)}
                            >
                                <span className="noto-sans-regular">
                                    ปฏิเสธ
                                </span>
                            </Button>
                        </>
                    )}

                    {status === OrderStatus.accepted && (
                        <Button
                            variant={isDelay === false ? "tertiary" : "secondary"}
                            disabled={isDelay || isUpdating}
                            size={"full"}
                            type="button"
                            className="flex w-full"
                            onClick={() => onDelayUpdate(orderId)}
                        >
                            <span className="noto-sans-regular">
                                {isDelay === false ? 'ล่าช้า10นาที' : 'แจ้งล่าช้าสำเร็จ'}
                            </span>
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
};
