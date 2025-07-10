import React, { useState } from "react";
import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";

export enum OrderStatus {
  receive = "receive",
  cooking = "cooking",
  ready = "ready",
  done = "done",
}

const orderNavbarVariants = cva(
  "flex w-full items-center justify-center -mx-6 min-w-lvw text-light text-sm",
  {
    variants: {
      variant: {
        receive: "",
        cooking: "",
        ready: "",
        done: "",
      },
    },
    defaultVariants: {
      variant: "receive",
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
  status,
  onStatusUpdate,
  ...props
}: CookerNavbarProps) => {
  const [state, setState] = useState<OrderStatus>(OrderStatus.receive);

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
        onClick={() => handleClick(OrderStatus.receive)}
        className={
          state === OrderStatus.receive
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        ออเดอร์ใหม่
      </button>
      <button
        onClick={() => handleClick(OrderStatus.cooking)}
        className={
          state === OrderStatus.cooking
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        กำลังปรุง
      </button>
      <button
        onClick={() => handleClick(OrderStatus.ready)}
        className={
          state === OrderStatus.ready
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        พร้อมเสิร์ฟ
      </button>
      <button
        onClick={() => handleClick(OrderStatus.done)}
        className={
          state === OrderStatus.done
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        เสร็จ
      </button>
    </div>
  );
};
