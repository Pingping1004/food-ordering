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
        menuImg: string;
        totalPrice?: number;
        sellPriceDisplay: number;
        // unitPrice: number;
        // maxDaily: number;
        // cookingTime: number;
        // isAvailable: boolean;
        restaurantId: string;
        isPriority: boolean;
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
    isPriority,
    ...props
}: MenuProfileProps) {
    const { getQuantity, addToCart, removeFromCart } = useCart();
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
            <div className="relative w-[183px] h-[183px] aspect-square">
                <Image
                    width={183}
                    height={183}
                    sizes="(max-width: 768px) 120px, 183px"
                    src={menuImg}
                    priority={isPriority}
                    fetchPriority={isPriority ? "high" : "auto"}
                    quality={50}
                    alt="Menu profile"
                    className="rounded-lg object-cover aspect-auto w-full h-full"
                />
            </div>

            <div className="flex flex-col gap-y-2 w-full">
                <h3 className="font-noto-thai text-bold text-sm text-primary">{name}</h3>
                <div className="flex justify-between items-center text-sm">
                    <p className="text-light font-noto-thai">{sellPriceDisplay} บาท</p>

                    <div className="flex items=center gap-x-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondarySuccess"
                            onClick={() => removeFromCart(menuId)}
                        >
                            -
                        </Button>
                        <p className="flex text-secondary font-noto-thai text-bold items-center">{quantity}</p>
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