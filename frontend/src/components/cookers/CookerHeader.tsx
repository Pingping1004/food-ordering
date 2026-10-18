export interface Restaurant {
    restaurantId: string;
    name: string;
    location?: string;
    openTime: string;
    closeTime: string;
    isLargeTextMode?: boolean;
    right?: React.ReactNode;
}

export default function CookerHeader({
    name,
    openTime,
    closeTime,
    isLargeTextMode = false,
    right,
}: Readonly<Restaurant>) {
    return (
        <header className="flex flex-col gap-3.5 border-b border-line-soft bg-white px-5 py-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-brand-muted">โรงอาหาร</span>
                    <h1 className={`font-bold leading-tight ${isLargeTextMode ? "text-[26px]" : "text-[22px]"}`}>{name}</h1>
                </div>
                {right}
            </div>
            {openTime && closeTime && (
                <div className="flex items-center justify-between rounded-[14px] bg-success-light px-4 py-3">
                    <span className={`flex items-center gap-2.5 font-semibold text-success-main ${isLargeTextMode ? "text-[21px]" : "text-lg"}`}>
                        <span className="h-3 w-3 rounded-full bg-success-main" />เวลาเปิด
                    </span>
                    <span className="text-[15px] font-medium text-success-main">{openTime}–{closeTime}</span>
                </div>
            )}
        </header>
    );
}
