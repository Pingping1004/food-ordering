import React from "react";
import Image from "next/image";
import { Button } from "../Button";
import { cva, VariantProps } from "class-variance-authority";
import clsx from "clsx";

const orderVariants = cva("noto-sans-regular justify-center text-sm", {
  variants: {
    variant: {
      receive: "",
      cooking: "",
      ready: "",
      done: "",
    },
    isPaid: {
      true: "",
      false: "",
    },
    selected: {
      default: "",
      true: "",
      false: "",
    },
    issued: {
      no: "",
      delay: "",
      rejected: "",
    }
  },
  defaultVariants: {
    variant: "receive",
    isPaid: true,
    selected: "default",
    issued: "no",
  },
});

export type OrderProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof orderVariants> & {
    orderId: string;
    name: string;
    price: number;
    restaurantName: string;
    orderAt: Date | string | number;
    deliverAt: Date | string | number;
    selected: "default" | boolean;
    isPaid: boolean;
    orderMenu: { units: number; value: string }[];
    details?: string;
  };

export const Order = ({
  orderId,
  variant = "done",
  isPaid = true,
  selected = "default",
  issued = "no",
  name,
  price = 0,
  restaurantName,
  orderAt = new Date(),
  deliverAt,
  orderMenu = [],
  details,
  className,
  children,
  ...props
}: OrderProps) => {

  return (
    <div
      className={clsx(
        "flex flex-col p-4 border-1 border-[#E1E1E1] rounded-2xl gap-y-6",
        orderVariants({ variant, isPaid, selected, issued }),
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

          {/* No icon for "default" */}
          <div>
            <h3 className="noto-sans-bold text-lg text-primary">
              ออเดอร์: 145
            </h3>
            <p className="text-light text-xs">สั่งเมื่อ 11:45 - 12/01/67</p>
          </div>
        </div>

        <Button
          variant={isPaid ? "secondarySuccess" : "secondaryDanger"}
          size="sm"
          type="button"
        >
          {isPaid ? "ชำระแล้ว" : "ยังไม่ชำระ"}
        </Button>
      </header>

      <main className="flex grid-rows-2 justify-between">
        <div className="w-1/2 text-sm text-secondary">
          <p className="mb-2 text-primary">รายละเอียดออเดอร์:</p>
          <p>1x - ข้าวผัดสเต็กแซลม่อน</p>
          <p>1x - ข้าวผัดสเต็กแซลม่อน</p>
        </div>

        <div className="flex w-1/2 grid-cols-2 items-end justify-end md:gap-x-6 gap-x-4">
          <div className="text-center">
            <p className="text-xs">รับออเดอร์:</p>
            <h4 className="text-base text-secondary">12:15</h4>
          </div>

          <div className="text-center">
            <p className="text-xs">ราคา:</p>
            <h4 className="text-base text-secondary">240 บาท</h4>
          </div>
        </div>
      </main>

      <section>
        <p className="noto-sans-bold text-sm">ปล. ขอไม่เผ็ด กินเผ็ดไม่เก่ง</p>
      </section>

      {variant === "done" ? (
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
          <Button variant="primary" size="md" className="flex w-full" type="button">
            <span className="noto-sans-regular">
              {variant === "receive" && "รับออเดอร์"}
              {variant === "cooking" && "เริ่มปรุงอาหาร"}
              {variant === "ready" && "พร้อมเสิร์ฟ"}
            </span>
          </Button>

          <Button
            variant={
              issued === "rejected" ? "secondarySuccess" : "secondaryDanger"
            }
            disabled={issued === "delay" ? true : false}
            size="md"
            type="button"
            className="flex w-full"
          >
            <span className="noto-sans-regular">
              {issued !== "rejected" ? "ล่าช้า10นาที" : "อนุมัติการชำระเงิน"}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
};
