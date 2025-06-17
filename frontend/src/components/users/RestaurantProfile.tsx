import React from 'react'
import Image from 'next/image'
import clsx from 'clsx'
import { cva, VariantProps } from 'class-variance-authority'

export enum RestaurantCategory {
    Steak = 'Steak',
    Halal = 'Halal',
    Made_to_order = 'Made_to_order',
    Esan = 'Esan',
    Rice = 'Rice',
    Appetizer = 'Appetizer',
    Noodle = 'Noodle',
};

const restaurantProfileVariant = cva("", {
    variants: {
        variant: {
            isOpen: '',
            isClose: 'opacity-50 cursor-not-allowed',
        },
    },
    defaultVariants: {
        variant: 'isOpen',
    },
});

export type RestaurantProfileProps = React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof restaurantProfileVariant> & {
        restaurantId: string;
        restaurantImg: string;
        name: string;
        categories: RestaurantCategory[];
        openTime: Date | string;
        closeTime: Date | string;
    }

export const RestaurantProfile: React.FC<RestaurantProfileProps> = ({
    restaurantId,
    variant = "isOpen",
    name,
    restaurantImg,
    categories,
    children,
    openTime,
    closeTime,
    className,
    ...props

}: RestaurantProfileProps) => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const src = restaurantImg ? `${baseURL}/${restaurantImg}` : `/picture.svg`;

    return (
        <div className={clsx(
            "flex flex-col gap-y-4",
            restaurantProfileVariant({ variant }),
            className
        )}
            {...props}
        >
            <Image
                width={163}
                height={163}
                src={src}
                alt='Restaurant Profile'
                className="rounded-lg"
            />

            <div className="flex flex-col gap-y-2">
                <h3 className="noto-sans-bold text-sm text-primary">{name}</h3>
                <p className="noto-sans-regular text-xs text-light">{categories.join(', ')}</p>
            </div>
        </div>
    );
};
