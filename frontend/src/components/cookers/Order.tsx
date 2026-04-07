import React, { useCallback, useMemo } from "react";
import { Button } from "../Button";
import { cva } from "class-variance-authority";
import clsx from "clsx";
import { getTimeFormat } from "@/util/time";
import { OrderStatus, PaymentStatus } from "./OrderNavbar";

const orderCardVariants = cva(
    "flex flex-col border border-[#E1E1E1] rounded-2xl font-noto-thai",
    {
        variants: {
            selected: {
                true: "ring-2 ring-primary",
                false: "",
            },
            size: {
                default: "p-4 gap-y-6 text-sm",
                large: "p-6 gap-y-8 text-lg",
            },
        },
        defaultVariants: {
            selected: false,
            size: "default",
        },
    }
);

export type OrderMenuEntry = {
    quantity: number;
    menuName: string;
    menuImg?: string;
};

export type OrderProps = React.HTMLAttributes<HTMLDivElement> & {
    orderId: string;
    orderAt: string;
    deliverAt: string;
    status: OrderStatus;
    selected?: boolean;
    totalAmount: number;
    paymentStatus: PaymentStatus;
    isDelay?: boolean;
    orderMenus: OrderMenuEntry[];
    details?: string;
    userTel: string;
    acceptAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    refundAt?: Date;
    isLargeTextMode?: boolean;
    isDelayDisabled?: boolean;
    isRejectedDisabled?: boolean;
    onDelayUpdate: (orderId: string) => void;
    onStatusUpdate: (orderId: string, status: OrderStatus) => void;
};

type ScaledTextProps = {
    large?: boolean;
    className?: string;
    children: React.ReactNode;
};

const ScaledText = ({ large, className, children }: ScaledTextProps) => (
    <span className={clsx(large ? "text-2xl font-bold" : "text-lg", className)}>
        {children}
    </span>
);

export const Order = ({
    orderId,
    selected = false,
    orderAt,
    userTel,
    status,
    deliverAt,
    totalAmount,
    paymentStatus,
    isDelay = false,
    orderMenus = [],
    details,
    className,
    isLargeTextMode = false,
    isDelayDisabled = false,
    isRejectedDisabled = false,
    onDelayUpdate,
    onStatusUpdate,
    ...props
}: OrderProps) => {
    const lg = isLargeTextMode;

    // Stable references so child Buttons don't re-render unnecessarily
    const handleAccept = useCallback(
        () => onStatusUpdate(orderId, OrderStatus.accepted),
        [orderId, onStatusUpdate]
    );
    const handleReject = useCallback(
        () => onStatusUpdate(orderId, OrderStatus.rejected),
        [orderId, onStatusUpdate]
    );
    const handleDelay = useCallback(
        () => onDelayUpdate(orderId),
        [orderId, onDelayUpdate]
    );

    // Computed once per render, not inline inside JSX
    const isDeliveryPast = useMemo(
        () => new Date(deliverAt).getTime() <= Date.now(),
        [deliverAt]
    );

    const formattedAmount = useMemo(
        () =>
            new Intl.NumberFormat("th-TH", {
                style: "currency",
                currency: "THB",
            }).format(totalAmount),
        [totalAmount]
    );

    return (
        <div
            className={clsx(
                orderCardVariants({ selected, size: lg ? "large" : "default" }),
                className
            )}
            {...props}
        >

            <header className="flex items-start justify-between">
                <div className="flex flex-col gap-y-1 text-left">
                    <div className="flex items-center gap-x-2">
                        <h3
                            className={clsx(
                                "font-bold text-primary",
                                lg ? "text-3xl" : "text-xl"
                            )}
                        >
                            {orderId.substring(0, 4)}
                        </h3>

                        <p
                            className={clsx(
                                "flex items-center text-secondary",
                                lg ? "text-xl" : "text-sm"
                            )}
                        >
                            (<span className="mr-1">เบอร์ติดต่อ:</span>

                            <a href={`tel:${userTel}`}
                                className="text-info underline hover:opacity-80"
                            >
                                {userTel}
                            </a>
                            )
                        </p>
                    </div>

                    <p className={clsx("text-light", lg ? "" : "text-sm")}>
                        สั่งเมื่อ {orderAt}
                    </p>
                </div>
            </header>

            <main className="flex justify-between gap-x-4">
                <div className={clsx("w-1/2 text-secondary", lg && "text-lg")}>
                    <p className="mb-2 text-primary">รายละเอียดออเดอร์:</p>
                    {orderMenus.map((item, index) => (
                        <p
                            key={`${item.menuName}-${index}`}
                            className={clsx(lg ? "text-2xl mb-1 font-bold" : "text-lg")}
                        >
                            {item.quantity}× {item.menuName}
                        </p>
                    ))}
                </div>

                <div className="flex w-1/2 items-end justify-end gap-x-4 md:gap-x-6">
                    <div className="text-center">
                        <p className={clsx(!lg && "text-sm")}>จัดส่ง:</p>
                        <h4
                            className={clsx(
                                "text-secondary",
                                lg ? "text-2xl font-bold" : "text-xl"
                            )}
                        >
                            {getTimeFormat(deliverAt)}
                        </h4>
                    </div>

                    <div className="text-center">
                        <p className={clsx(!lg && "text-sm")}>ราคา:</p>
                        <h4
                            className={clsx(
                                "text-secondary",
                                lg ? "text-2xl font-bold" : "text-xl"
                            )}
                        >
                            {formattedAmount}
                        </h4>
                    </div>
                </div>
            </main>

            {details && (
                <section>
                    <p className={clsx("text-secondary", lg ? "text-lg" : "text-sm")}>
                        {details}
                    </p>
                </section>
            )}

            <footer>
                {status === OrderStatus.completed && (
                    <Button
                        variant="secondarySuccess"
                        size={lg ? "lg" : "md"}
                        className="w-full"
                        type="button"
                    >
                        <ScaledText large={lg}>ออเดอร์เสร็จสิ้น</ScaledText>
                    </Button>
                )}

                {status === OrderStatus.accepted && (
                    <div className="flex w-full gap-x-4">
                        <Button
                            variant={
                                paymentStatus === PaymentStatus.paid
                                    ? "secondarySuccess"
                                    : "secondaryDanger"
                            }
                            size="full"
                            type="button"
                        >
                            <ScaledText large={lg}>
                                {paymentStatus === PaymentStatus.paid
                                    ? "ชำระเงินแล้ว"
                                    : "ยังไม่ชำระเงิน"}
                            </ScaledText>
                        </Button>

                        <Button
                            variant={isDelay ? "secondary" : "tertiary"}
                            disabled={isDelay || isDelayDisabled || isDeliveryPast}
                            size="full"
                            type="button"
                            className="w-full"
                            onClick={handleDelay}
                        >
                            <ScaledText large={lg}>
                                {isDelay ? "แจ้งล่าช้าสำเร็จ" : "ล่าช้า 10 นาที"}
                            </ScaledText>
                        </Button>
                    </div>
                )}

                {status === OrderStatus.sent && (
                    <div className="grid grid-cols-2 gap-x-2">
                        <Button
                            variant="primary"
                            size={lg ? "lg" : "md"}
                            className="w-full"
                            type="button"
                            onClick={handleAccept}
                        >
                            <ScaledText large={lg}>รับออเดอร์</ScaledText>
                        </Button>

                        <Button
                            variant="secondaryDanger"
                            disabled={isRejectedDisabled}
                            size={lg ? "lg" : "md"}
                            type="button"
                            className="w-full"
                            onClick={handleReject}
                        >
                            <ScaledText large={lg}>ปฏิเสธ</ScaledText>
                        </Button>
                    </div>
                )}
            </footer>
        </div>
    );
};

export default Order;