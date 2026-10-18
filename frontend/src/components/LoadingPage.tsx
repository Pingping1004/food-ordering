"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { Logo } from "@/components/Logo";

interface LoadingPageProps {
  className?: string;
  message?: string;
}

export default function LoadingPage({
  className = "min-h-screen",
  message = "กำลังโหลดข้อมูล...",
}: LoadingPageProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center w-full bg-ground font-app p-6 ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="flex flex-col items-center max-w-sm w-full gap-5">
        {/* Brand Icon with gentle glow */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-2 rounded-2xl bg-primary-main/20 blur-md animate-pulse" />
          <Logo size={56} className="relative shadow-md animate-pulse" />
        </div>

        {/* Message with micro-pulse */}
        <p className="text-base font-bold text-brand-dark tracking-wide">
          {message}
        </p>

        {/* Contextual Card Skeleton */}
        <div className="w-full rounded-2xl border border-line-soft bg-white p-4 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          </div>
          <div className="pt-2 border-t border-row-line flex flex-col gap-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}