import React, { useState } from "react";
import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";

export enum OrderStatus {
  paid = "paid",
  accepted = "accepted",
  rejected = "rejected",
  refund_pending = "refund_pending",
  refund_complete = "refund_complete",
}

const orderNavbarVariants = cva(
    "flex w-full items-center justify-center -mx-6 min-w-lvw text-light text-sm",
    {
        variants: {
            variant: {
                paid: "",
                accepted: "",
                rejected: "",
                refund_pending: "",
                refund_complete: "",
            },
        },
        defaultVariants: {
            variant: "accepted",
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
    const [state, setState] = useState<OrderStatus>(OrderStatus.accepted);

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
                onClick={() => handleClick(OrderStatus.paid)}
                className={
                    state === OrderStatus.paid
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
                ออเดอร์ที่รับแล้ว
            </button>

            <button
                onClick={() => handleClick(OrderStatus.refund_pending)}
                className={
                    state === OrderStatus.refund_pending
                        ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
                        : "w-1/2 p-2"
                }
            >
                รอการคืนเงิน
            </button>

            <button
                onClick={() => handleClick(OrderStatus.refund_complete)}
                className={
                    state === OrderStatus.refund_complete
                        ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
                        : "w-1/2 p-2"
                }
            >
                คืนเงินเสร็จสิ้น
            </button>
        </div>
    );
};
