import { SchoolOverviewSkeleton } from "@/components/ui/Skeleton";

export default function SchoolLoading() {
    return (
        <div className="mx-auto flex min-h-app w-full max-w-[1280px] flex-col gap-6 p-6 font-app">
            <SchoolOverviewSkeleton />
        </div>
    );
}
