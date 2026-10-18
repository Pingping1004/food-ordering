import clsx from "clsx";
import { Chip, Icon } from "@/components/ui/kit";
import { REFUND_STATUS, formatBaht, formatDateTime } from "@/lib/schema/format";
import type { RefundItem, RefundRequest, RefundRequestStatus } from "@/lib/schema";

export function RefundStatusChip({ status, short }: Readonly<{ status: RefundRequestStatus; short?: boolean }>) {
    const s = REFUND_STATUS[status] ?? { label: status, short: status, tone: "neutral" as const, icon: "clock" as const };
    return <Chip tone={s.tone} icon={s.icon}>{short ? s.short : s.label}</Chip>;
}

type Step = { label: string; sub?: string; state: "done" | "now" | "todo" | "stop" };

/** Timeline derived from the request's own timestamps (the API has no event list). `forStudent` words it from the student's side. */
export function refundSteps(r: Pick<RefundRequest, "status" | "createdAt" | "decidedAt" | "refundedAt" | "decisionNote" | "decidedBy">, forStudent = false): Step[] {
    const steps: Step[] = [{ label: forStudent ? "ส่งคำขอแล้ว" : "นักเรียนส่งคำขอ", sub: formatDateTime(r.createdAt), state: "done" }];
    if (r.status === "PENDING") {
        steps.push({ label: forStudent ? "รอโรงเรียนตรวจสอบ" : "รอโรงเรียนตัดสินใจ", sub: forStudent ? "ปกติไม่เกิน 1 วันทำการ" : undefined, state: "now" });
        steps.push({ label: "โอนคืนเงิน", state: "todo" });
        return steps;
    }
    if (r.status === "REJECTED") {
        steps.push({ label: "ไม่อนุมัติ", sub: [formatDateTime(r.decidedAt), r.decidedBy?.name && !forStudent ? `โดย ${r.decidedBy.name}` : null].filter((x) => x && x !== "-").join(" · ") || undefined, state: "stop" });
        return steps;
    }
    steps.push({ label: "โรงเรียนอนุมัติ", sub: [formatDateTime(r.decidedAt), r.decidedBy?.name && !forStudent ? `โดย ${r.decidedBy.name}` : null].filter((x) => x && x !== "-").join(" · ") || undefined, state: "done" });
    steps.push(r.status === "REFUNDED"
        ? { label: "โอนคืนเงินแล้ว", sub: formatDateTime(r.refundedAt), state: "done" }
        : { label: "โอนคืนเงิน", sub: forStudent ? "จะแจ้งเมื่อโอนแล้ว" : "รอบันทึกเมื่อโอนคืนแล้ว", state: "now" });
    return steps;
}

export function RefundTimeline({ steps }: Readonly<{ steps: Step[] }>) {
    return (
        <ol className="flex flex-col gap-4">
            {steps.map((s) => (
                <li key={s.label} className="flex items-start gap-3" aria-current={s.state === "now" ? "step" : undefined}>
                    <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white", s.state === "done" && "bg-success-main", s.state === "now" && "bg-primary-main", s.state === "stop" && "bg-danger-main", s.state === "todo" && "box-border border-2 border-line")}>
                        {s.state === "done" && <Icon name="check" size={14} strokeWidth={3} />}
                        {s.state === "stop" && <Icon name="x" size={14} strokeWidth={3} />}
                    </span>
                    <span className="flex flex-col gap-0.5">
                        <span className={clsx("text-[15px]", s.state === "now" ? "font-bold" : s.state === "todo" ? "text-brand-muted" : "font-semibold")}>{s.label}</span>
                        {s.sub && <span className="text-[13px] text-brand-muted">{s.sub}</span>}
                    </span>
                </li>
            ))}
        </ol>
    );
}

export function RefundItems({ items, total }: Readonly<{ items: RefundItem[]; total?: number }>) {
    return (
        <ul className="flex flex-col divide-y divide-row-line rounded-[14px] border border-line-soft">
            {items.map((it, i) => (
                <li key={`${it.menuName}-${i}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[15px]">
                    <span className="min-w-0 flex-1 truncate">{it.menuName} <span className="text-brand-muted">× {it.quantity}</span></span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatBaht(it.totalPrice)} บาท</span>
                </li>
            ))}
            {total != null && (
                <li className="flex items-center justify-between gap-3 bg-ground px-3.5 py-2.5 text-[15px] font-bold">
                    <span>รวม</span><span className="tabular-nums">{formatBaht(total)} บาท</span>
                </li>
            )}
        </ul>
    );
}

/** API `code` -> sentence for the student's refund form. */
export const REFUND_ERROR_TEXT: Record<string, string> = {
    ORDER_NOT_PAID: "ออเดอร์นี้ยังไม่ได้ชำระเงิน จึงขอคืนเงินไม่ได้",
    REFUND_WINDOW_EXPIRED: "เลยกำหนด 24 ชั่วโมงหลังรับอาหารแล้ว ขอคืนเงินในแอปไม่ได้ กรุณาติดต่อโรงเรียนโดยตรง",
    REFUND_ALREADY_REQUESTED: "ออเดอร์นี้มีคำขอคืนเงินอยู่แล้ว",
};
