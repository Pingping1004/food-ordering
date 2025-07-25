"use client";

import clsx from "clsx";
import { VariantProps, cva } from "class-variance-authority";
import React, { useCallback } from "react";
import { Button } from "../Button";
import Image from "next/image";
import { Toggle } from "../Toggle";
import { useRouter } from "next/navigation";

const menuVariants = cva("", {
    variants: {
        variant: {
            default: "",
            managing: "",
        },
        isAvailable: {
            true: "",
            false: "",
        },
    },
    defaultVariants: {
        variant: "default",
        isAvailable: true,
    },
});

type MenuProps = React.HtmlHTMLAttributes<HTMLDivElement> &
    VariantProps<typeof menuVariants> & {
        restaurantId: string;
        menuId: string;
        name: string;
        menuImg?: string;
        maxDaily: number;
        cookingTime: number;
        createdAt: Date | string | number;
        price: number;
        isAvailable: boolean;
        onAvailabilityChanged: (menuId: string, newAvailability: boolean) => void;
        onDelete: (menuId: string) => void;
    };

export const Menu = ({
    className,
    menuId,
    name,
    menuImg,
    maxDaily,
    cookingTime,
    price,
    isAvailable,
    variant = "default",
    onAvailabilityChanged,
    onDelete,
    ...props
}: MenuProps) => {


    const router = useRouter();
    const src = menuImg ?? '/picture.svg';

    const handleToggleClick = useCallback((checked: boolean) => {
        // Pass the new checked state directly to the parent
        onAvailabilityChanged(menuId, checked);
    }, [menuId, onAvailabilityChanged]);

    const handleDelete = () => {
        // Call the parent's onDelete function immediately with the menuId
        // The parent function will handle optimistic UI and backend call
        onDelete(menuId);
    };

    return (
        <div
            className={clsx(
                "flex flex-col p-4 border-1 border-[#E1E1E1] rounded-2xl gap-y-6",
                menuVariants({ variant, isAvailable }),
                className
            )}
            {...props}
        >
            <header className="flex items-center">
                <Image
                    src={src}
                    alt={name}
                    width={96}
                    height={96}
                    className="h-24 w-24 object-cover mr-6 rounded-2xl"
                />
                <div className="flex w-full flex-col gap-y-2">
                    <div className="flex items-start gap-x-1">
                        <h3 className="w-[140px] noto-sans-bold text-md text-primary">{name}</h3>
                        <div className="flex flex-col">
                            <p className="text-md text-light noto-sans-bold">{price}</p>
                            <p className="text-sm text-light">บาท</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-secondary text-xs">
                            เวลาในการปรุง: {cookingTime}
                        </p>
                        <p className="text-secondary text-xs">
                            จำนวนมากสุดต่อจาน: {maxDaily}
                        </p>
                    </div>
                </div>
            </header>

            <footer className="flex gap-x-6 justify-between">
                <Button
                    size="md"
                    className="flex w-full"
                    type="button"
                    onClick={() => router.push(`/edit-menu/${menuId}`)}
                >
                    แก้ไขเมนู
                </Button>

                <Button
                    variant="secondaryDanger"
                    size="md"
                    className="flex w-full"
                    type="button"
                    onClick={handleDelete}
                >
                    ลบเมนู
                </Button>

                <Toggle
                    id={menuId}
                    label="เปิดขาย"
                    checked={isAvailable}
                    onCheckedChange={handleToggleClick}
                />
            </footer>
        </div>
    );
};
