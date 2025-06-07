import React, { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { cva } from "class-variance-authority";

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


export const OrderNavBar = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {

  const [state, setState] = useState<'receive' | 'cooking' | 'ready' | 'done'>('receive');

    const handleClick = (newState: 'receive' | 'cooking' | 'ready' | 'done') => {
        setState(newState);
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
      <Link
        href="/"
        onClick={() => handleClick('receive')}
        className={
          state === "receive"
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        ออเดอร์ใหม่
      </Link>
      <Link
        href="/cooking-orders"
        onClick={() => handleClick('cooking')}
        className={
          state === "cooking"
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        กำลังปรุง
      </Link>
      <Link
        href="/serving-orders"
        onClick={() => handleClick('ready')}
        className={
          state === "ready"
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        พร้อมเสิร์ฟ
      </Link>
      <Link
        href="/done-orders"
        onClick={() => handleClick('done')}
        className={
          state === "done"
            ? "w-1/4 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/4 p-2"
        }
      >
        เสร็จ
      </Link>
    </div>
  );
};
