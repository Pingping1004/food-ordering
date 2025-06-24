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
    const { getQuantity, addToCart } = useCart();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const src = menuImg ? `${baseUrl}/${menuImg}` : `/picture.svg`;
    const quantity = getQuantity(menuId) > 0 ? `X ${getQuantity(menuId)}` : '';

    return (
        <div
            className={clsx(
                "flex flex-col gap-y-4 w-full",
                menuProfileVariant({ variant }),
                className
            )}

            {...props}
        >
            <div className="relative w-full aspect-square">
                <Image
                    width={163}
                    height={163}
                    src={src}
                    alt="Menu profile"
                    className="rounded-lg object-cover w-full h-full"
                />

                <button
                    key={menuId}
                    className="absolute bottom-2 right-2 z-10"
                    onClick={() => {
                        console.log('Add clicked:', menuId, name, unitPrice);
                        addToCart(menuId, name, unitPrice, menuImg || "")
                    }}
                >
                    <img src="/plus.svg" alt="add menu" />
                </button>
            </div>

            <div className="flex flex-col gap-y-2 w-full">
                <h3 className="noto-sans-bold text-sm text-primary">{name}</h3>
                <div className="flex justify-between items-center text-xs">
                    <p className="text-light noto-sans-regular">{unitPrice}</p>
                    <p className="text-primary-light noto-sans-bold">{quantity}</p>
                </div>
            </div>
        </div>
    )
}