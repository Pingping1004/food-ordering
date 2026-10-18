import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function AdminLoading() {
    return (
        <div role="status" aria-label="กำลังโหลด" className="mx-auto flex min-h-app w-full max-w-[1280px] flex-col gap-5 px-[clamp(16px,3vw,40px)] py-7 font-app">
            {/* Page header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-8 w-52 rounded-lg" />
                    <Skeleton className="h-4 w-36 rounded" />
                </div>
                <Skeleton className="h-11 w-36 rounded-[10px]" />
            </div>

            {/* KPI tiles */}
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
                <Skeleton className="h-[98px] rounded-2xl" />
                <Skeleton className="h-[98px] rounded-2xl" />
                <Skeleton className="h-[98px] rounded-2xl" />
            </div>

            {/* Table card */}
            <div className="rounded-[18px] border border-line-soft bg-white p-4 sm:p-5">
                <TableSkeleton rows={6} cols={5} />
            </div>
        </div>
    );
}
