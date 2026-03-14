import React, { useState } from "react";
import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";

export enum OrderStatus {
  sent = "sent",
  accepted = "accepted",
  cancelled = "cancelled",
  completed = "completed",
}

export enum PaymentStatus {
    paid = "paid",
    unpaid = "unpaid",
    verifying = "verifying",
    failed = "failed",
    refund_pending = "refund_pending",
    refund_complete = "refund_complete"
}

const orderNavbarVariants = cva(
    "flex w-full items-center justify-center -mx-6 min-w-lvw text-light text-sm",
    {
        variants: {
            variant: {
                sent: "",
                accepted: "",
                cancelled: "",
                completed: ""
            },
        },
        defaultVariants: {
            variant: "sent",
        },
    }
);

export type CookerNavbarProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof orderNavbarVariants> & {
    status: OrderStatus;
    onStatusUpdate: (navStatus: OrderStatus) => void;
};

export const OrderNavBar = ({
    className,
    onStatusUpdate,
    ...props
}: CookerNavbarProps) => {
    const [state, setState] = useState<OrderStatus>(OrderStatus.sent);

    const handleClick = (newState: OrderStatus) => {
        setState(newState);
        onStatusUpdate(newState);
    };

    return (
        <div
            className={clsx(
                "text-center",
                orderNavbarVariants({ variant: state }),
                className
            )}
            {...props}
        >
            <button
                onClick={() => handleClick(OrderStatus.sent)}
                className={
                    state === OrderStatus.sent
                        ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
                        : "w-1/2 p-2"
                }
            >
                ออเดอร์ใหม่
            </button>

            <button
                onClick={() => handleClick(OrderStatus.accepted)}
                className={
                    state === OrderStatus.accepted
                        ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
                        : "w-1/2 p-2"
                }
            >
                รับแล้ว
            </button>

            <button
                onClick={() => handleClick(OrderStatus.completed)}
                className={
                    state === OrderStatus.completed
                        ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
                        : "w-1/2 p-2"
                }
            >
                เสร็จสิ้น
            </button>

            <button
                onClick={() => handleClick(OrderStatus.cancelled)}
                className={
                    state === OrderStatus.cancelled
                        ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
                        : "w-1/2 p-2"
                }
            >
                ยกเลิก
            </button>
        </div>
    );
};
