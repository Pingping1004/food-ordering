import React from "react";
import clsx from "clsx";

export enum OrderStatus {
  receive = "receive",
  cooking = "cooking",
  ready = "ready",
  done = "done",
  delay = "delay",
  rejected = "rejected",
  // Legacy / UI mapping aliases
  sent = "sent",
  accepted = "accepted",
  cancelled = "cancelled",
  completed = "completed",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PAID = "PAID",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  // Legacy / UI mapping aliases
  paid = "paid",
  unpaid = "unpaid",
  verifying = "verifying",
  refund_pending = "refund_pending",
  refund_complete = "refund_complete"
}

/** Tabs follow the new schema lifecycle: receive → cooking → ready → done (or rejected). */
export type NavState = "receive" | "cooking" | "ready" | "history";

export type CookerNavbarProps = {
    status: NavState;
    isLargeTextMode?: boolean;
    counts?: Partial<Record<NavState, number>>;
    className?: string;
    onStatusUpdate: (navStatus: NavState) => void;
};

const TABS: { key: NavState; label: string; urgent?: boolean }[] = [
    { key: "receive", label: "ใหม่", urgent: true },
    { key: "cooking", label: "กำลังทำ" },
    { key: "ready", label: "รอรับ" },
    { key: "history", label: "เสร็จ/ยกเลิก" },
];

export const OrderNavBar = ({
    className,
    status,
    counts = {},
    onStatusUpdate,
    isLargeTextMode = false,
}: CookerNavbarProps) => {
    return (
        <nav aria-label="สถานะออเดอร์" className={clsx("grid grid-cols-2 gap-2.5 px-5 pb-2 pt-4", className)}>
            {TABS.map((t) => {
                const active = status === t.key;
                const count = counts[t.key] ?? 0;
                const urgent = t.urgent && count > 0;
                return (
                    <button
                        key={t.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onStatusUpdate(t.key)}
                        className={clsx(
                            "flex h-[60px] items-center justify-center gap-2.5 rounded-2xl font-bold",
                            isLargeTextMode ? "text-xl" : "text-lg",
                            active ? "bg-primary-main text-white" : "border-[1.5px] border-line-soft bg-white text-brand-dark"
                        )}
                    >
                        {t.label}
                        <span className={clsx(
                            "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[17px]",
                            urgent ? "bg-brand-orange text-brand-dark" : active ? "bg-white text-primary-dark" : "bg-primary-light text-primary-dark"
                        )}>{count}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default OrderNavBar
