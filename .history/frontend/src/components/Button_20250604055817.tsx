import { cva, VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import React from 'react';
import { NumberIssued } from './NumberIssue';

const button = cva('noto-sans-regular justify-center text-sm', {
    variants: {
        variant: {
            primary: 'bg-primary-main text-white',
            secondary: 'bg-primary-light text-primary-main',
            danger: 'bg-danger-main text-white',
            'secondary-danger': 'bg-danger-light text-danger-main',
        },
        size: {
            md: 'px-5 py-2.5 rounded-2xl',
            lg: 'px-6 py-3 rounded-2xl',
            full: 'w-full py-3 rounded-2xl noto-sans-bold',
            half: 'w-1/2 py-2.5 rounded-2xl',
        },
        disabled: {
            true: 'opacity-50 cursor-not-allowed',
            false: 'cursor-pointer',
        }
    },
    defaultVariants: {
        variant: 'primary',
        size: 'md',
        disabled: false,
    },
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof button> & {
        icon?: React.ReactNode;
        iconPosition?: 'start' | 'end';
        issuedOrder?: number;
    };

export const Button = ({
    className,
    variant,
    size = ,
    issuedOrder,
    disabled,
    icon,
    iconPosition = 'start',
    children,
    ...props
}: ButtonProps) => {
    return (
        <button className={clsx(button({ variant, size, disabled }), className)} {...props}>
            {icon && iconPosition === 'start' && <span className="flex pr-2">{icon}</span>}
            <span className="flex gap-x-2">{children}</span>
            {icon && iconPosition === 'end' && <span>{icon}</span>}
            {issuedOrder !== undefined && (
                <span>
                    <NumberIssued issuedOrder={issuedOrder} size={size || undefined} />
                </span>
            )}
        </button>
    );
}