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
    isLargeTextMode?: boolean
    onStatusUpdate: (navStatus: OrderStatus) => void;
};

export const OrderNavBar = ({
    className,
    onStatusUpdate,
    isLargeTextMode = false,
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
                className={`w-1/2 p-2
                    ${state === OrderStatus.sent ? "text-primary border-b-2 border-primary-main" : ""}
                    ${isLargeTextMode ? "text-lg py-3" : "text-sm"}
                `}
            >
                ออเดอร์ใหม่
            </button>

            <button
                onClick={() => handleClick(OrderStatus.accepted)}
                className={`w-1/2 p-2
                    ${state === OrderStatus.accepted ? "text-primary border-b-2 border-primary-main" : ""}
                    ${isLargeTextMode ? "text-lg py-3" : "text-sm"}
                `}
            >
                รับแล้ว
            </button>

            <button
                onClick={() => handleClick(OrderStatus.completed)}
                className={`w-1/2 p-2
                    ${state === OrderStatus.completed ? "text-primary border-b-2 border-primary-main" : ""}
                    ${isLargeTextMode ? "text-lg py-3" : "text-sm"}
                `}
            >
                เสร็จสิ้น
            </button>

            <button
                onClick={() => handleClick(OrderStatus.cancelled)}
                className={`w-1/2 p-2
                    ${state === OrderStatus.cancelled ? "text-primary border-b-2 border-primary-main" : ""}
                    ${isLargeTextMode ? "text-lg py-3" : "text-sm"}
                `}
            >
                ยกเลิก
            </button>
        </div>
    );
};
