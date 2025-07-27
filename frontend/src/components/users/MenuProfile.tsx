import React from "react";
import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { Button } from "../Button";

const menuProfileVariant = cva("", {
    variants: {
        variant: {
            on: '',
            off: 'opacity-50 cursor-not-allowed pointer-events-none',
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
        sellPriceDisplay: number;
        // unitPrice: number;
        // maxDaily: number;
        // cookingTime: number;
        // isAvailable: boolean;
        restaurantId: string;
    }

export default function MenuProfile({
    menuId,
    variant,
    className,
    name,
    menuImg,
    // unitPrice, //
    // totalPrice, //
    sellPriceDisplay,
    // maxDaily, //
    // cookingTime, //
    // isAvailable, //
    restaurantId, //
    ...props
}: MenuProfileProps) {
    const { getQuantity, addToCart, removeFromCart } = useCart();
    const src = menuImg ? `${menuImg}` : `/picture.svg`;
    const quantity = getQuantity(menuId) > 0 ? `${getQuantity(menuId)}` : '';

    return (
        <div
            className={clsx(
                "flex flex-col gap-y-4",
                menuProfileVariant({ variant }),
                className
            )}

            {...props}
        >
            <div className="relative w-[163px] h-[163px] aspect-square">
                <Image
                    width={163}
                    height={163}
                    src={src}
                    alt="Menu profile"
                    className="rounded-lg object-cover aspect-square w-full h-full"
                />
            </div>

            <div className="flex flex-col gap-y-2 w-full">
                <h3 className="noto-sans-bold text-sm text-primary">{name.substring(0, 21)}</h3>
                <div className="flex justify-between items-center text-sm">
                    <p className="text-light noto-sans-regular">{sellPriceDisplay}</p>

                    <div className="flex items=center gap-x-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondarySuccess"
                            onClick={() => removeFromCart(menuId)}
                        >
                            -
                        </Button>
                        <p className="flex text-secondary noto-sans-bold items-center">{quantity}</p>
                        <Button
                            type="button"
                            size="sm"
                            variant="success"
                            onClick={() => addToCart(menuId, name, sellPriceDisplay, menuImg || "", restaurantId)}
                        >
                            +
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}