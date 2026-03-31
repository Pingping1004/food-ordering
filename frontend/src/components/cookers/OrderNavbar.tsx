import React, { useState } from "react";
import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";

export enum OrderStatus {
  sent = "sent",
  accepted = "accepted",
  cancelled = "cancelled",
  rejected = "rejected",
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

export type NavState = "sent" | "accepted" | "completed" | "cancelled_group";

const orderNavbarVariants = cva(
    "flex w-full items-center justify-center -mx-6 min-w-lvw text-light text-sm",
    {
        variants: {
            variant: {
                sent: "",
                accepted: "",
                cancelled: "",
                rejected: "",
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
    status: NavState;
    isLargeTextMode?: boolean
    onStatusUpdate: (navStatus: NavState) => void;
};

export const OrderNavBar = ({
    className,
    onStatusUpdate,
    isLargeTextMode = false,
    ...props
}: CookerNavbarProps) => {
    const [state, setState] = useState<NavState>("sent");

    const handleClick = (newState: NavState) => {
        setState(newState);
        onStatusUpdate(newState);
    };

    const baseBtn = `w-1/2 p-2 ${isLargeTextMode ? "text-lg py-3" : "text-sm"}`;
    const active = "text-primary border-b-2 font-noto-thai font-bold border-primary-main";

    return (
        <div
            className={clsx(
                "text-center",
                orderNavbarVariants(),
                className
            )}
            {...props}
        >
            <button
                onClick={() => handleClick("sent")}
                className={clsx(baseBtn, state === "sent" && active)}
            >
                ออเดอร์ใหม่
            </button>

            <button
                onClick={() => handleClick("accepted")}
                className={clsx(baseBtn, state === "accepted" && active)}
            >
                รับแล้ว
            </button>

            <button
                onClick={() => handleClick("completed")}
                className={clsx(baseBtn, state === "completed" && active)}
            >
                เสร็จสิ้น
            </button>

            <button
                onClick={() => handleClick("cancelled_group")}
                className={clsx(baseBtn, state === "cancelled_group" && active)}
            >
                ยกเลิก/ไม่รับ
            </button>
        </div>
    );
};

export default OrderNavBar