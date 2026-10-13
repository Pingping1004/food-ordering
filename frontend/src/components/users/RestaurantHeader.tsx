import Image from 'next/image';
import { estimateDelayBufferFromOrderAmount } from '@/lib/calculate-time';

interface RestaurantHeaderType {
    restaurantId: string;
    orderAmount: number;
    name: string;
    restaurantImg: string;
    openTime: string;
    closeTime: string;
    adminTel: string;
}

export default function RestaurantHeader({ name, restaurantImg, orderAmount, openTime, closeTime, adminTel }: Readonly<RestaurantHeaderType>) {
    const min = estimateDelayBufferFromOrderAmount(orderAmount)

    return (
        <div className="flex flex-col sm:flex-row w-full gap-4 sm:gap-6 px-5 py-5 bg-white border border-slate-200/60 shadow-sm rounded-2xl transition-all hover:shadow-md">
            {/* Image Section */}
            <div className="flex-shrink-0 relative self-start sm:self-center">
                <div className="absolute inset-0 bg-primary-main/10 rounded-2xl -m-1.5 opacity-50" />
                <Image
                    src={restaurantImg}
                    width={90}
                    height={90}
                    alt={`${name} profile`}
                    loading="lazy"
                    quality={75}
                    className="object-cover aspect-square rounded-xl relative z-10 shadow-sm border border-slate-100 bg-slate-50"
                />
            </div>
            
            {/* Content Section */}
            <div className="flex flex-col flex-1 justify-center gap-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-display font-bold text-xl sm:text-2xl text-slate-900 leading-tight">{name}</h3>
                    
                    {/* Wait Time Badge */}
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full w-fit border border-amber-100 shadow-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-bold font-body">รอประมาณ {min} - {min + 5} นาที</span>
                    </div>
                </div>

                {/* Details Section */}
                <div className="flex gap-x-8 sm:flex-row gap-3 sm:gap-6 mt-1">
                    {/* Open Time */}
                    <div className="flex items-center gap-2.5 text-slate-500">
                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">เวลาเปิดขาย</span>
                            <span className="text-xs font-semibold text-slate-700 font-body">{openTime} - {closeTime}</span>
                        </div>
                    </div>

                    {/* Contact Number */}
                    <div className="flex items-center gap-2.5 text-slate-500">
                        <div className="w-8 h-8 rounded-full bg-primary-light/50 border border-primary-light flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-primary-main" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">เบอร์ติดต่อร้าน</span>
                            <a href={`tel:${adminTel}`} className="text-xs font-bold text-primary-main hover:text-primary-main/80 hover:underline transition-colors font-body">
                                {adminTel}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
