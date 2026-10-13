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

const restaurantProfileVariant = cva("group relative flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 overflow-hidden", {
    variants: {
        variant: {
            isOpen: 'hover:shadow-xl hover:border-primary-light hover:-translate-y-1 cursor-pointer',
            isClose: 'grayscale-[0.5] opacity-80 cursor-not-allowed',
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
        isOpen: boolean;
        isPriority: boolean;
    }

export const RestaurantProfile: React.FC<RestaurantProfileProps> = ({
    restaurantId,
    variant,
    name,
    restaurantImg,
    isOpen,
    isPriority,
    className,
    categories,
    ...props
}: RestaurantProfileProps) => {

    const content = (
        <div className={clsx(
            restaurantProfileVariant({ variant }),
            className
        )}
        {...props}
        >
            <div className="relative w-full aspect-square overflow-hidden bg-slate-50">
                <Image
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    src={restaurantImg}
                    priority={isPriority}
                    fetchPriority={isPriority ? "high" : "auto"}
                    quality={75}
                    alt={`${name} Profile`}
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                />
                
                {!isOpen && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px] z-10">
                        <span className="bg-white/95 text-slate-800 font-bold text-[11px] px-3 py-1.5 rounded-full shadow-lg font-body">
                            ปิดรับออเดอร์
                        </span>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-y-1 p-3.5 sm:p-4">
                <h3 className="font-noto-thai font-semibold text-base sm:text-base text-slate-900 line-clamp-1 group-hover:text-primary-main transition-colors">
                    {name}
                </h3>
                
                {categories && categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                        {categories.slice(0, 2).map(cat => (
                            <span key={cat} className="text-[9px] sm:text-[10px] font-bold bg-primary-light text-slate-500 px-2 py-1 rounded-full uppercase tracking-wider font-body">
                                {cat.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (isOpen) {
        return (
            <Link href={`/user/restaurant/${restaurantId}`} className="block">
                {content}
            </Link>
        );
    } else {
        return <div className="block">{content}</div>;
    }
};

export default RestaurantProfile