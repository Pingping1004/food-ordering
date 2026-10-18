"use client";

import clsx from "clsx";
import React from "react";

/**
 * Premium Shimmer Skeleton base component.
 * Includes gentle wave animation and theme-aware neutral colors.
 */
export function Skeleton({
    className,
    shimmer = true,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
    return (
        <div
            aria-hidden="true"
            className={clsx(
                "rounded-xl bg-slate-200/90 dark:bg-slate-800/80",
                shimmer && "animate-shimmer",
                className
            )}
            {...props}
        />
    );
}

/**
 * Skeleton lines of text with varying natural widths.
 */
export function SkeletonText({
    lines = 3,
    className,
}: {
    lines?: number;
    className?: string;
}) {
    const widths = ["w-full", "w-5/6", "w-3/5", "w-4/5", "w-2/3"];
    return (
        <div className={clsx("flex flex-col gap-2", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={clsx("h-3.5 rounded-md", widths[i % widths.length])}
                />
            ))}
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
 * RESTAURANT & MENU SKELETONS (User Portal)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Matches RestaurantProfile card in the user browse page.
 */
export function RestaurantCardSkeleton() {
    return (
        <div className="flex items-center gap-3.5 rounded-[18px] border border-line-soft bg-white p-3.5 shadow-sm">
            <Skeleton className="h-[84px] w-[84px] shrink-0 rounded-2xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                    <Skeleton className="h-3.5 w-24 rounded" />
                </div>
            </div>
        </div>
    );
}

export function RestaurantListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <RestaurantCardSkeleton key={i} />
            ))}
        </div>
    );
}

/**
 * Matches MenuProfile item card in restaurant detail page.
 */
export function MenuCardSkeleton() {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="h-[76px] w-[76px] shrink-0 rounded-xl" />
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <Skeleton className="h-4.5 w-3/4 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                </div>
            </div>
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        </div>
    );
}

export function MenuListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <MenuCardSkeleton key={i} />
            ))}
        </div>
    );
}

/**
 * Matches Restaurant detail page header + category + menus.
 */
export function RestaurantDetailSkeleton() {
    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] md:max-w-3xl lg:max-w-6xl flex-col bg-ground font-app text-brand-dark">
            {/* Header */}
            <div className="flex flex-col gap-3.5 border-b border-line-soft bg-white p-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-6 w-44 rounded-md" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-2xl" />
                    <div className="flex flex-col gap-2 flex-1">
                        <Skeleton className="h-5 w-36 rounded-md" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-4 w-20 rounded" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-col gap-3.5 px-4 pb-28 pt-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-6 w-28 rounded-md" />
                    <Skeleton className="h-4 w-16 rounded" />
                </div>
                <MenuListSkeleton count={6} />
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ORDER SKELETONS (User Tracking & History)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Matches an item on /user/orders history page.
 */
export function OrderCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 rounded-[18px] border border-line-soft bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-20 rounded" />
            </div>
            <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <Skeleton className="h-4.5 w-40 rounded" />
                    <Skeleton className="h-3.5 w-24 rounded" />
                </div>
                <Skeleton className="h-5 w-16 rounded-md" />
            </div>
        </div>
    );
}

export function OrderListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-3">
            {Array.from({ length: count }).map((_, i) => (
                <OrderCardSkeleton key={i} />
            ))}
        </div>
    );
}

/**
 * Matches /user/order/wait/[orderId] tracking screen.
 */
export function OrderTrackingSkeleton({ title }: { title?: string } = {}) {
    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line-soft bg-white px-4 py-3.5">
                <Skeleton className="h-8 w-8 rounded-lg" />
                {title ? (
                    <span className="text-sm font-semibold text-brand-muted">{title}</span>
                ) : (
                    <Skeleton className="h-6 w-36 rounded-md" />
                )}
                <Skeleton className="h-4 w-16 rounded" />
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
                {/* Big status card */}
                <div className="flex flex-col gap-4 rounded-3xl bg-primary-main/15 p-6 border border-primary-main/20">
                    <Skeleton className="h-6 w-32 rounded-full" />
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-28 rounded" />
                        <Skeleton className="h-12 w-44 rounded-xl" />
                        <Skeleton className="h-4 w-40 rounded" />
                    </div>
                    <Skeleton className="h-3 w-full rounded-full" />
                </div>

                {/* Timeline card */}
                <div className="flex flex-col gap-3 rounded-2xl border border-line-soft bg-white p-5">
                    <Skeleton className="h-5 w-28 rounded-md" />
                    <div className="flex flex-col gap-4 pt-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                                <div className="flex flex-col gap-1 flex-1">
                                    <Skeleton className="h-4 w-32 rounded" />
                                    <Skeleton className="h-3 w-20 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order summary card */}
                <div className="flex flex-col gap-3 rounded-2xl border border-line-soft bg-white p-5">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-32 rounded-md" />
                        <Skeleton className="h-5 w-16 rounded" />
                    </div>
                    <div className="flex flex-col gap-2.5 pt-2">
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-4 w-4/5 rounded" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
 * COOKER / KITCHEN SKELETONS
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Matches Cooker live kitchen orders board (/cooker/[restaurantId]).
 */
export function CookerBoardSkeleton() {
    return (
        <div className="mx-auto flex min-h-app w-full flex-col bg-ground font-app text-brand-dark">
            {/* Cooker header */}
            <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-white px-5 py-3.5 shadow-xs">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-5 w-36 rounded-md" />
                        <Skeleton className="h-3.5 w-24 rounded" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-10 rounded-xl" />
                </div>
            </div>

            {/* Status tabs */}
            <div className="border-b border-line-soft bg-white px-5 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <Skeleton className="h-11 w-32 rounded-xl shrink-0" />
                    <Skeleton className="h-11 w-28 rounded-xl shrink-0" />
                    <Skeleton className="h-11 w-28 rounded-xl shrink-0" />
                    <Skeleton className="h-11 w-24 rounded-xl shrink-0" />
                </div>
            </div>

            {/* Live orders grid */}
            <div className="p-5">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-xs"
                        >
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-7 w-20 rounded-lg" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-28 rounded" />
                                    <Skeleton className="h-4 w-16 rounded" />
                                </div>
                                <div className="border-t border-row-line pt-3 flex flex-col gap-2">
                                    <Skeleton className="h-4 w-3/4 rounded" />
                                    <Skeleton className="h-4 w-2/3 rounded" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-row-line mt-4">
                                <Skeleton className="h-12 w-full rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Matches Cooker sales summary / stats page.
 */
export function CookerSummarySkeleton() {
    return (
        <div className="flex flex-col gap-5 p-5 max-w-5xl mx-auto font-app">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-44 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2 rounded-2xl border border-line-soft bg-white p-4 shadow-xs"
                    >
                        <Skeleton className="h-4 w-20 rounded" />
                        <Skeleton className="h-7 w-28 rounded-md" />
                        <Skeleton className="h-3 w-16 rounded" />
                    </div>
                ))}
            </div>

            {/* Chart Card */}
            <div className="rounded-2xl border border-line-soft bg-white p-5 shadow-xs">
                <Skeleton className="h-5 w-36 rounded-md mb-4" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
 * SCHOOL & ADMIN SKELETONS
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Matches School canteen overview dashboard (/school/[schoolId]).
 */
export function SchoolOverviewSkeleton() {
    return (
        <div className="flex flex-col gap-6 font-app">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-8 w-52 rounded-lg" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-11 w-36 rounded-xl" />
                    <Skeleton className="h-11 w-44 rounded-xl" />
                </div>
            </div>

            {/* 6 KPI Cards */}
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2 rounded-2xl border border-line-soft bg-white p-4 shadow-xs"
                    >
                        <Skeleton className="h-4 w-28 rounded" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                        <Skeleton className="h-4 w-16 rounded" />
                    </div>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-line-soft bg-white p-5 shadow-xs">
                    <Skeleton className="h-5 w-40 rounded-md mb-4" />
                    <Skeleton className="h-52 w-full rounded-xl" />
                </div>
                <div className="rounded-2xl border border-line-soft bg-white p-5 shadow-xs">
                    <Skeleton className="h-5 w-40 rounded-md mb-4" />
                    <Skeleton className="h-52 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}

/**
 * Clean data table skeleton for admin/payouts, school reports, etc.
 */
export function TableSkeleton({
    rows = 6,
    cols = 5,
}: {
    rows?: number;
    cols?: number;
}) {
    return (
        <div className="w-full overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-xs">
            {/* Table Head */}
            <div className="flex items-center border-b border-line-soft bg-neutral-light/50 px-4 py-3.5">
                {Array.from({ length: cols }).map((_, i) => (
                    <div
                        key={i}
                        className={clsx(
                            "flex-1",
                            i === 0 && "flex-[1.5]",
                            i === cols - 1 && "flex-[0.8] text-right"
                        )}
                    >
                        <Skeleton className="h-4 w-20 rounded" />
                    </div>
                ))}
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-row-line">
                {Array.from({ length: rows }).map((_, rIdx) => (
                    <div
                        key={rIdx}
                        className="flex items-center px-4 py-3.5 transition-colors"
                    >
                        {Array.from({ length: cols }).map((_, cIdx) => (
                            <div
                                key={cIdx}
                                className={clsx(
                                    "flex-1",
                                    cIdx === 0 && "flex-[1.5]",
                                    cIdx === cols - 1 && "flex-[0.8] flex justify-end"
                                )}
                            >
                                <Skeleton
                                    className={clsx(
                                        "h-4 rounded",
                                        cIdx === 0 ? "w-32" : cIdx === cols - 1 ? "h-8 w-16 rounded-lg" : "w-20"
                                    )}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Card list skeleton (e.g. for role requests, notifications, schools).
 */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-3">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="flex flex-col gap-3 rounded-[18px] border border-line-soft bg-white p-5 shadow-xs md:flex-row md:items-center md:justify-between"
                >
                    <div className="flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-36 rounded-md" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-24 rounded" />
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        <Skeleton className="h-10 w-24 rounded-xl" />
                        <Skeleton className="h-10 w-24 rounded-xl" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Form field skeleton.
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-white p-6 shadow-xs max-w-xl">
            <Skeleton className="h-6 w-44 rounded-md mb-2" />
            {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
            ))}
            <Skeleton className="h-12 w-32 rounded-xl mt-4 self-end" />
        </div>
    );
}

/**
 * Full page generic fallback skeleton with brand styling.
 */
export function PageSkeleton() {
    return (
        <div className="mx-auto flex min-h-app w-full max-w-[1200px] flex-col gap-5 p-5 font-app">
            {/* Topbar */}
            <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-6 w-36 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-20 rounded-xl" />
                    <Skeleton className="h-9 w-9 rounded-full" />
                </div>
            </div>

            {/* Banner/Header */}
            <div className="flex flex-col gap-2 pt-2">
                <Skeleton className="h-8 w-56 rounded-lg" />
                <Skeleton className="h-4 w-80 rounded" />
            </div>

            {/* Content Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-3 rounded-2xl border border-line-soft bg-white p-5 shadow-xs"
                    >
                        <Skeleton className="h-36 w-full rounded-xl" />
                        <Skeleton className="h-5 w-3/4 rounded-md" />
                        <Skeleton className="h-4 w-1/2 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
