import Image from 'next/image';
import Link from 'next/link';
import { estimateDelayBufferFromOrderAmount } from '@/lib/calculate-time';

interface RestaurantHeaderType {
    restaurantId: string;
    orderAmount: number;
    name: string;
    restaurantImg?: string | null;
    openTime?: string;
    closeTime?: string;
    /** `Restaurant.contactTel` (old API: adminTel) */
    adminTel?: string | null;
}

export default function RestaurantHeader({ name, restaurantImg, orderAmount, openTime, closeTime, adminTel }: Readonly<RestaurantHeaderType>) {
    const min = estimateDelayBufferFromOrderAmount(orderAmount)

    return (
        <header className="flex flex-col gap-4 border-b border-line-soft bg-white px-4 pb-5 pt-3">
            <div className="flex items-center gap-2">
                <Link href="/user/restaurant" aria-label="กลับไปหน้าเลือกร้าน" className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-dark hover:bg-ground">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </Link>
                <span className="text-[15px] text-brand-muted">โรงอาหาร</span>
            </div>

            <div className="flex items-center gap-3.5 px-1">
                {restaurantImg ? (
                    <Image
                        src={restaurantImg}
                        width={64}
                        height={64}
                        alt={`${name} profile`}
                        loading="lazy"
                        quality={75}
                        className="h-16 w-16 shrink-0 rounded-2xl bg-ground object-cover"
                    />
                ) : (
                    <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary-dark">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2M6 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>
                    </span>
                )}
                <div className="flex flex-col gap-1">
                    <h1 className="font-app text-2xl font-bold">{name}</h1>
                    {openTime && closeTime && <span className="text-sm font-semibold text-brand-muted">เปิดขาย {openTime} – {closeTime}</span>}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-1">
                <div className="flex flex-col gap-0.5 rounded-xl bg-ground p-2.5">
                    <span className="text-xs text-brand-muted">รอประมาณ</span>
                    <span className="text-base font-bold">{min}–{min + 5} นาที</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-xl bg-ground p-2.5">
                    <span className="text-xs text-brand-muted">คิวตอนนี้</span>
                    <span className="text-base font-bold">{orderAmount} ออเดอร์</span>
                </div>
                {adminTel ? (
                    <a href={`tel:${adminTel}`} className="flex flex-col gap-0.5 rounded-xl bg-ground p-2.5">
                        <span className="text-xs text-brand-muted">ติดต่อร้าน</span>
                        <span className="text-base font-bold text-primary-dark">โทร</span>
                    </a>
                ) : (
                    <div className="flex flex-col gap-0.5 rounded-xl bg-ground p-2.5">
                        <span className="text-xs text-brand-muted">ติดต่อร้าน</span>
                        <span className="text-base font-bold text-brand-muted">-</span>
                    </div>
                )}
            </div>
        </header>
    )
}
