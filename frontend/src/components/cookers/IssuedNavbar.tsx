import React, { useState } from "react";
import clsx from "clsx";
import { cva } from "class-variance-authority";

const issueOrderdNavbarVariants = cva(
  "flex w-full items-center justify-center -mx-6 min-w-lvw text-light text-sm",
  {
    variants: {
      variant: {
        delay: "",
        rejected: "",
      },
    },
    defaultVariants: {
      variant: "delay",
    },
  }
);

export type IssuedOrderNavbarProps = React.HTMLAttributes<HTMLDivElement> & {
  numberDelay?: number;
  numberRejected?: number;
};

export const IssuedOrderNavbar = ({
  numberRejected = 0,
  numberDelay = 0,
  className,
  ...props
}: IssuedOrderNavbarProps) => {
  const [state, setState] = useState<"delay" | "rejected">("delay");
  const handleClick = (newState: "delay" | "rejected") => {
    setState(newState);
    console.log("Current state:", state, "Updated state:", newState);
  };

  return (
    <div
      className={clsx(
        "text-center",
        issueOrderdNavbarVariants({ variant: state }),
        className
      )}
      {...props}
    >
      <button
        onClick={() => handleClick("delay")}
        className={
          state === "delay"
            ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/2 p-2"
        }
      >
        <div className="flex justify-center gap-x-1">
          <span>ล่าช้า</span>
          <span>{numberDelay > 0 ? numberDelay : `(0)`}</span>
        </div>
      </button>
      <button
        onClick={() => handleClick("rejected")}
        className={
          state === "rejected"
            ? "w-1/2 text-primary p-2 border-b-2 border-primary-main"
            : "w-1/2 p-2"
        }
      >
        <div className="flex justify-center gap-x-1">
          <span>ชำระเงินไม่ผ่าน</span>
          <span>{numberRejected > 0 ? numberRejected : `(0)`}</span>
        </div>
      </button>
    </div>
  );
};
