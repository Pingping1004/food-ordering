import Image from 'next/image'
import clsx from 'clsx'
import { cva, VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import { CATEGORY_LABEL } from '@/lib/schema/format'
import { Icon } from '@/components/ui/kit'

export enum RestaurantCategory {
    Steak = 'Steak',
    Halal = 'Halal',
    Made_to_order = 'Made_to_order',
    Esan = 'Esan',
    Rice = 'Rice',
    Appetizer = 'Appetizer',
    Noodle = 'Noodle',
};

const restaurantProfileVariant = cva("flex gap-3.5 rounded-[18px] border border-line-soft bg-white p-3.5 text-brand-dark transition-shadow", {
    variants: {
        variant: {
            isOpen: 'hover:shadow-md cursor-pointer',
            isClose: 'opacity-60 cursor-not-allowed',
        },
    },
    defaultVariants: {
        variant: 'isOpen',
    },
});

export type RestaurantProfileProps = React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof restaurantProfileVariant> & {
        restaurantId: string;
        /** `Restaurant.profile` in the new schema (may be empty) – the old API still calls it restaurantImg. */
        restaurantImg?: string | null;
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
        <div className={clsx(restaurantProfileVariant({ variant }), className)} {...props}>
            <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[14px] bg-ground">
                {restaurantImg ? (
                    <Image
                        fill
                        sizes="76px"
                        src={restaurantImg}
                        priority={isPriority}
                        fetchPriority={isPriority ? "high" : "auto"}
                        quality={75}
                        alt={`${name} Profile`}
                        className="object-cover"
                    />
                ) : (
                    <span className="flex h-full w-full items-center justify-center bg-primary-light text-primary-dark"><Icon name="plate" size={34} strokeWidth={1.8} /></span>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="line-clamp-1 font-app text-[17px] font-bold">{name}</h3>
                    <span className={clsx("inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold", isOpen ? "text-success-main" : "text-brand-muted")}>
                        <span className={clsx("h-2 w-2 rounded-full", isOpen ? "bg-success-main" : "bg-brand-muted")} />
                        {isOpen ? "เปิดอยู่" : "ปิดรับออเดอร์"}
                    </span>
                </div>

                {categories && categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {categories.slice(0, 3).map(cat => (
                            <span key={cat} className="rounded-lg bg-[#F2F4F7] px-2.5 py-0.5 text-[13px] font-semibold text-[#344054]">
                                {CATEGORY_LABEL[cat] ?? cat.replace(/_/g, ' ')}
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