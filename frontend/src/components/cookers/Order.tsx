/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";
import Image from "next/image";
import { Button } from "../Button";
import { cva, VariantProps } from "class-variance-authority";
import clsx from "clsx";

const renderOrderStatusLabel = (status: 'receive' | 'cooking' | 'deliver' | 'done') => {
    if (status === 'receive') return 'เริ่มปรุงอาหาร'
    if (status === 'cooking') return 'พร้อมเสิร์ฟ'
    if (status === 'deliver') return 'จบออเดอร์'
}

const orderVariants = cva("noto-sans-regular justify-center text-sm", {
    variants: {
        variant: {
            receive: "",
            cooking: "",
            ready: "",
            done: "",
        },
        isPaid: {
            paid: "",
            unpaid: "",
            processing: "",
            rejected: "",
        },
        selected: {
            default: "",
            true: "",
            false: "",
        },
        isDelay: {
            true: "",
            false: "",
        }
    },
    defaultVariants: {
        variant: "receive",
        isPaid: "unpaid",
        selected: "default",
        isDelay: false,
    },
});

export type OrderProps = React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof orderVariants> & {
        orderId: string;
        orderAt: string;
        deliverAt: string;
        status: 'receive' | 'cooking' | 'deliver' | 'done';
        selected: "default" | boolean;
        totalAmount: number;
        isPaid: "paid" | "unpaid" | "selected" | "rejected";
        isDelay: boolean;
        orderMenus: { quantity: number; menuName: string; menuImg?: string }[];
        details?: string;
    };

export const Order = ({
    orderId,
    variant,
    selected = "default",
    orderAt,
    status = "receive",
    deliverAt,
    totalAmount,
    isPaid,
    isDelay = false,
    orderMenus = [],
    details,
    className,
    children,
    ...props
}: OrderProps) => {

    return (
        <div
            className={clsx(
                "flex flex-col p-4 border-1 border-[#E1E1E1] rounded-2xl gap-y-6",
                orderVariants({ variant, isPaid, selected, isDelay }),
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

                    <div>
                        <h3 className="noto-sans-bold text-lg text-primary">
                            ออเดอร์: 145
                        </h3>
                        <p className="text-light text-xs">สั่งเมื่อ {orderAt}</p>
                    </div>
                </div>

                <Button
                    variant={isPaid === 'paid' ? "secondarySuccess" : "secondaryDanger"}
                    size="sm"
                    type="button"
                >
                    {isPaid === 'paid' ? "ชำระแล้ว" : "ยังไม่ชำระ"}
                </Button>
            </header>

            <main className="flex grid-rows-2 justify-between">
                <div className="w-1/2 text-sm text-secondary">
                    <p className="mb-2 text-primary">รายละเอียดออเดอร์:</p>
                    {orderMenus.map((item, index) => (
                        <p
                            key={index}
                        >{item.quantity}x - {item.menuName}</p>
                    ))}
                </div>

                <div className="flex w-1/2 grid-cols-2 items-end justify-end md:gap-x-6 gap-x-4">
                    <div className="text-center">
                        <p className="text-xs">รับออเดอร์:</p>
                        <h4 className="text-base text-secondary">{deliverAt}</h4>
                    </div>

                    <div className="text-center">
                        <p className="text-xs">ราคา:</p>
                        <h4 className="text-base text-secondary">{totalAmount}</h4>
                    </div>
                </div>
            </main>

            {/* <section>
                <p className="noto-sans-bold text-sm">{details}</p>
            </section> */}

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
                            {renderOrderStatusLabel(status)}
                        </span>
                    </Button>

                    <Button
                        variant="secondaryDanger"
                        disabled={isDelay === true ? true : false}
                        size="md"
                        type="button"
                        className="flex w-full"
                    >
                        <span className="noto-sans-regular">
                            ล่าช้า10นาที
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );
};
