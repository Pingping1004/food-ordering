import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";
import Image from "next/image";
import { useCart } from "@/context/CartContext";

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
        menuImg?: string | null;
        totalPrice?: number;
        sellPriceDisplay: number;
        // unitPrice: number;
        // maxDaily: number;
        // cookingTime: number;
        isAvailable: boolean;
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
    isAvailable,
    restaurantId, //
    isPriority,
    ...props
}: MenuProfileProps) {
    const { getQuantity, addToCart, removeFromCart } = useCart();

    const qtyNum = getQuantity(menuId);

    return (
        <li
            className={clsx(
                "flex list-none items-center gap-3.5 rounded-2xl bg-white p-3",
                qtyNum > 0 ? "border-[1.5px] border-primary-main" : "border border-line-soft",
                menuProfileVariant({ variant }),
                className
            )}
            {...(props as React.HTMLAttributes<HTMLLIElement>)}
        >
            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-ground">
                {menuImg ? (
                    <Image
                        width={72}
                        height={72}
                        sizes="72px"
                        src={menuImg}
                        priority={isPriority}
                        fetchPriority={isPriority ? "high" : "auto"}
                        quality={50}
                        alt={name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-primary-light text-primary-dark">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0zM7 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M17 7c0-2 2-2 2-4" /></svg>
                    </span>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="font-app text-base font-semibold text-brand-dark">{name}</h3>
                <p className="font-app text-[17px] font-bold text-brand-dark">{sellPriceDisplay} บาท</p>
                {!isAvailable && <p className="text-[13px] font-medium text-danger-main">หมดแล้ววันนี้</p>}
            </div>

            {qtyNum > 0 ? (
                <div className="flex items-center gap-1 rounded-xl bg-primary-light p-0.5">
                    <button type="button" aria-label={`ลดจำนวน ${name}`} onClick={() => removeFromCart(menuId)}
                        className="h-11 w-11 text-[22px] font-bold text-primary-dark">−</button>
                    <span className="min-w-5 text-center text-[17px] font-bold text-primary-dark">{qtyNum}</span>
                    <button type="button" aria-label={`เพิ่มจำนวน ${name}`}
                        onClick={() => addToCart(menuId, name, sellPriceDisplay, menuImg ?? '', isAvailable, restaurantId)}
                        className="h-11 w-11 text-[22px] font-bold text-primary-dark">+</button>
                </div>
            ) : (
                <button
                    type="button"
                    aria-label={`เพิ่ม ${name} ลงตะกร้า`}
                    onClick={() => addToCart(menuId, name, sellPriceDisplay, menuImg ?? '', isAvailable, restaurantId)}
                    className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary-main text-white hover:bg-primary-dark"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
            )}
        </li>
    )
}
