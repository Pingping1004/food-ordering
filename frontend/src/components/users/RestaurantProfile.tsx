import React from 'react'
import Image from 'next/image'
import clsx from 'clsx'
import { cva, VariantProps } from 'class-variance-authority'
import Link from 'next/link'

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
            isClose: 'opacity-50 cursor-not-allowed pointer-events-none',
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
        // openTime: Date | string;
        // closeTime: Date | string;
        isOpen: boolean;
    }

export const RestaurantProfile: React.FC<RestaurantProfileProps> = ({
    restaurantId,
    variant,
    name,
    restaurantImg,
    categories,
    isOpen,
    // openTime,
    // closeTime,
    className,
    ...props

}: RestaurantProfileProps) => {
    const src = restaurantImg ? `${restaurantImg}` : `/picture.svg`;

    const content = (
        <div className={clsx(
            "flex flex-col gap-y-4 border-color",
            restaurantProfileVariant({ variant }),
            className
        )}
        {...props}
        >
            <div className="flex relative w-[163px] h-[163px] justify-center aspect-square">
                <Image
                    width={163}
                    height={163}
                    src={src}
                    alt='Restaurant Profile'
                    className="rounded-lg object-cover w-full h-full"
                />
            </div>

            <div className="flex flex-col gap-y-2">
                <h3 className="noto-sans-bold text-sm text-primary">{name.substring(0, 15)}</h3>
                <p className="noto-sans-regular text-xs text-light">{categories.join(', ')}</p>
            </div>
        </div>
    );

    if (isOpen) {
        return (
            <Link href={`/user/restaurant/${restaurantId}`}>
                {content}
            </Link>
        );
    } else {
        return content;
    }
};
