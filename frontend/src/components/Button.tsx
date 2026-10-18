import { cva, VariantProps } from "class-variance-authority";
import clsx from "clsx";
import { IconNumber } from "./IconNumber";

const button = cva("font-app justify-center text-base font-semibold transition-colors active:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-main", {
    variants: {
        variant: {
            primary: "bg-primary-main text-white hover:bg-primary-dark",
            secondary: "bg-primary-light text-primary-dark",
            tertiary: "border-[1.5px] border-primary-main bg-white text-primary-dark",
            danger: "bg-danger-main text-white",
            success: "bg-success-main text-white",
            secondaryDanger: "bg-danger-light text-danger-main",
            secondarySuccess: "bg-success-light text-success-main",
        },
        size: {
            sm: "min-h-11 px-4 py-2 rounded-xl text-sm font-app",
            md: "min-h-12 px-6 py-2.5 rounded-xl",
            lg: "min-h-14 px-6 py-3 rounded-2xl text-lg font-bold",
            full: "w-full min-h-14 py-3 rounded-2xl font-app text-[17px] font-bold",
            half: "w-1/2 min-h-12 py-2.5 rounded-xl",
            select: "min-h-12 rounded-xl p-3 border-[1.5px] border-primary-main"
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
