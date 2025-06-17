import React from "react";
import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";
import Image from "next/image";
import { useCart } from "@/context/CartContext";

const menuProfileVariant = cva("", {
    variants: {
        variant: {
            on: '',
            off: 'opacity-50 cursor-not-allowed',
        },
    },
    defaultVariants: {
        variant: 'on',
    }
});

export type MenuProfileProps = React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof menuProfileVariant> & {
        menuId: string;
        name: string;
        menuImg?: string;
        totalPrice?: number;
        unitPrice: number;
        maxDaily: number;
        cookingTime: number;
        isAvailable: boolean;
        restaurantId: string;
    }

export default function MenuProfile({
    menuId,
    variant = 'on',
    className,
    name,
    menuImg,
    unitPrice,
    totalPrice,
    maxDaily,
    cookingTime,
    isAvailable,
    restaurantId,
    children,
    ...props
}: MenuProfileProps) {
    const { addToCart } = useCart();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const src = menuImg ? `${baseUrl}/${menuImg}` : `/picture.svg`;

    return (
        <div
            className={clsx(
                "flex flex-col gap-y-4",
                menuProfileVariant({ variant }),
                className
            )}

            {...props}
        >
            <div className="relative w-fit">
                <Image
                    width={163}
                    height={163}
                    src={src}
                    alt="Menu profile"
                    className="rounded-lg object-cover w-[163px] h-[163px]"
                />

                <button 
                    className="absolute bottom-2 right-2 z-10"
                    onClick={() => addToCart(menuId, name, unitPrice)}
                >
                    <img src="/plus.svg" alt="add menu"/>
                </button>
            </div>

            <div className="flex flex-col gap-y-2">
                <h3 className="noto-sans-bold text-sm text-primary">{name}</h3>
                <p className="noto-sans-regular text-xs text-light">{unitPrice}</p>
            </div>
        </div>
    )
}