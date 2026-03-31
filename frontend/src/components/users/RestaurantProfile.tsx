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
        isPriority: boolean;
    }

export const RestaurantProfile: React.FC<RestaurantProfileProps> = ({
    restaurantId,
    variant,
    name,
    restaurantImg,
    categories,
    isOpen,
    isPriority,
    // openTime,
    // closeTime,
    className,
    ...props

}: RestaurantProfileProps) => {

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
                    sizes="(max-width: 768px) 120px, 163px"
                    src={restaurantImg}
                    priority={isPriority}
                    fetchPriority={isPriority ? "high" : "auto"}
                    quality={50}
                    alt='Restaurant Profile'
                    className="rounded-lg object-cover aspect-square w-full h-full"
                />
            </div>

            <div className="flex flex-col gap-y-2">
                <h3 className="font-noto-thai text-bold text-sm text-primary">{name}</h3>
                <p className="font-noto-thai text-xs text-light">{categories.slice(0, 2).join(', ')}</p>
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

export default RestaurantProfile