import clsx from "clsx";
import { VariantProps, cva } from "class-variance-authority";
import React, { useCallback, useRef } from "react";
import Image from "next/image";
import { Toggle } from "../Toggle";
import { useRouter } from "next/navigation";
import { hasMenuPhoto } from "@/lib/types/menu";

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
        restaurantid: string;
        menuId: string;
        name: string;
        menuImg?: string | null;
        price: number;
        isAvailable: boolean;
        onAvailabilityChanged: (
            menuId: string,
            newAvailability: boolean,
        ) => void;
        /** Omit for cooks: only the owner may delete a menu. */
        onDelete?: (menuId: string) => void;
        /** Called with the picked file when the owner taps the empty photo slot. */
        onPhotoSelected?: (menuId: string, file: File) => void;
    };

export const Menu = ({
    className,
    menuId,
    name,
    menuImg,
    price,
    isAvailable,
    variant = "default",
    onAvailabilityChanged,
    onDelete,
    onPhotoSelected,
    ...props
}: MenuProps) => {
    const router = useRouter();
    const photoInputRef = useRef<HTMLInputElement>(null);

    const handleToggleClick = useCallback(
        (checked: boolean) => {
            // Pass the new checked state directly to the parent
            onAvailabilityChanged(menuId, checked);
        },
        [menuId, onAvailabilityChanged],
    );

    const handleDelete = () => {
        // Call the parent's onDelete function immediately with the menuId
        // The parent function will handle optimistic UI and backend call
        onDelete?.(menuId);
    };

    return (
        <li
            className={clsx(
                "flex list-none flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-4",
                menuVariants({ variant, isAvailable }),
                className,
            )}
            {...(props as React.HTMLAttributes<HTMLLIElement>)}
        >
            <div className="flex items-center gap-3.5">
                {hasMenuPhoto(menuImg) ? (
                    <Image
                        src={menuImg}
                        alt={name}
                        width={64}
                        height={64}
                        className="h-16 w-16 shrink-0 rounded-[14px] bg-ground object-cover"
                    />
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={!onPhotoSelected}
                            aria-label={`เพิ่มรูปเมนู ${name}`}
                            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px] border-[1.5px] border-dashed border-primary-main bg-primary-light text-primary-dark enabled:hover:bg-white"
                        >
                            <svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M3 11h18a9 9 0 0 1-18 0zM7 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M17 7c0-2 2-2 2-4" />
                            </svg>
                            {onPhotoSelected && (
                                <span className="text-xs font-semibold">
                                    เพิ่มรูป
                                </span>
                            )}
                        </button>
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) onPhotoSelected?.(menuId, file);
                            }}
                        />
                    </>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                `/cooker/restaurant/edit-menu/${menuId}`,
                            )
                        }
                        className="text-left text-xl font-bold leading-snug"
                    >
                        {name}
                    </button>
                    <span className="text-lg">{price} บาท</span>
                </div>
                <Toggle
                    id={menuId}
                    label={`เปิดขาย ${name}`}
                    checked={isAvailable}
                    onCheckedChange={handleToggleClick}
                    onText="ขาย"
                    offText="ปิด"
                />
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() =>
                        router.push(`/cooker/restaurant/edit-menu/${menuId}`)
                    }
                    aria-label={`แก้ไขเมนู ${name}`}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] font-semibold hover:bg-ground"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    แก้ไขเมนู
                </button>
                {onDelete && <button
                    type="button"
                    onClick={handleDelete}
                    aria-label={`ลบเมนู ${name}`}
                    className="min-h-10 flex-1 rounded-xl border-[1.5px] border-transparent px-3 text-[15px] font-semibold text-[#B42318] hover:bg-danger-light"
                >
                    ลบเมนู
                </button>}
            </div>
        </li>
    );
};
