import { cva, VariantProps } from "class-variance-authority";
import clsx from "clsx";
import React from "react";
import { IconNumber } from "./IconNumber";

const button = cva("noto-sans-regular justify-center text-sm", {
    variants: {
        variant: {
            primary: "bg-primary-main text-white",
            secondary: "bg-primary-light text-primary-main",
            tertiary: "border-1 border-primary text-primary-color text-sm",
            danger: "bg-danger-main text-white",
            success: "bg-success-main text-white",
            secondaryDanger: "bg-danger-light text-danger-main",
            secondarySuccess: "bg-success-light text-success-main",
        },
        size: {
            sm: "px-3 py-2 rounded-2xl text-xs noto-sans-regular",
            md: "px-5 py-2.5 rounded-2xl",
            lg: "px-6 py-3 rounded-2xl",
            full: "w-full py-3 rounded-2xl noto-sans-bold!",
            half: "w-1/2 py-2.5 rounded-2xl",
            select: "rounded-2xl p-3"
        },
        disabled: {
            true: "opacity-50 cursor-not-allowed pointer-events-none",
            false: "cursor-pointer",
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "md",
        disabled: false,
    },
});

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    icon?: React.ReactNode;
    iconPosition?: "start" | "end";
    numberIcon?: number;
    type: "button" | "submit" | "reset"
  };

export const Button = ({
    className,
    variant,
    size = "md",
    type = "button",
    numberIcon,
    disabled,
    iconPosition = "start",
    children,
    ...props
}: ButtonProps) => {
    const icon = numberIcon !== undefined && (
        <IconNumber
            numberIcon={numberIcon}
            size={
                size === "sm" || size === "select"
                    ? "md"
                    : (size as "md" | "lg" | "full" | "half" | undefined)
            }
            className={clsx(
                "bg-white text-primary p-1",
                iconPosition === "start" ? "mr-2" : "ml-2"
            )}
        />
    );

    return (
        <button
            className={clsx(
                "flex items-center justify-center",
                button({ variant, size, disabled }),
                className
            )}
            type={type || "button"}
            {...props}
        >
            {iconPosition === "start" && icon}
            {children}
            {iconPosition === "end" && icon}
        </button>
    );
};
