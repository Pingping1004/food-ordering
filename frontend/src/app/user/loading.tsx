import { RestaurantListSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function UserLoading() {
    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] md:max-w-3xl lg:max-w-6xl flex-col bg-ground font-app">
            {/* Header skeleton */}
            <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line-soft bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Skeleton className="h-9 w-9 rounded-xl" />
                        <Skeleton className="h-6 w-32 rounded-md" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-full" />
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
            </div>

            {/* Main content skeleton */}
            <main className="flex flex-1 flex-col gap-4 p-5">
                {/* Notice pill */}
                <Skeleton className="h-12 w-full rounded-2xl" />

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <Skeleton className="h-10 w-20 rounded-full shrink-0" />
                    <Skeleton className="h-10 w-24 rounded-full shrink-0" />
                    <Skeleton className="h-10 w-20 rounded-full shrink-0" />
                    <Skeleton className="h-10 w-24 rounded-full shrink-0" />
                </div>

                {/* Section title */}
                <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-6 w-36 rounded-md" />
                    <Skeleton className="h-4 w-24 rounded" />
                </div>

                {/* Cards */}
                <RestaurantListSkeleton count={6} />
            </main>
        </div>
    );
}
