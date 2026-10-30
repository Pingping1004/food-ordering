"use client";

import Link from "next/link";
import { Icon, Notice } from "@/components/ui/kit";
import { RefundStatusChip } from "@/components/refunds/RefundParts";
import { useMyRefunds } from "@/hook/useRefunds";
import { refundReasonLabel } from "@/lib/schema/format";
import type { RefundRequest } from "@/lib/schema";

/** The request that currently speaks for an order: any non-rejected one, else the newest rejected one. */
export function requestFor(list: RefundRequest[] | undefined, orderId: string | undefined): RefundRequest | undefined {
    if (!list || !orderId) return undefined;
    const mine = list.filter((r) => r.orderId === orderId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return mine.find((r) => r.status !== "REJECTED") ?? mine[0];
}

/** On an order screen: the status of its refund request (with the school's note), or an entry point to ask for one. */
export function RefundEntry({ orderId, canRequest }: Readonly<{ orderId: string; canRequest: boolean }>) {
    const { data } = useMyRefunds();
    const req = requestFor(data, orderId);
    const href = `/user/order/refund/${orderId}`;

    if (req) {
        return (
            <section aria-label="คำขอคืนเงิน" className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[17px] font-bold">คำขอคืนเงิน</h2>
                    <RefundStatusChip status={req.status} />
                </div>
                <span className="text-sm text-brand-muted">เหตุผล: {refundReasonLabel(req.reason)}</span>
                {req.decisionNote && <p className="m-0 rounded-xl bg-ground p-3 text-[15px] leading-relaxed">ข้อความจากร้าน: {req.decisionNote}</p>}
                <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-primary-dark">
                    {req.status === "REJECTED" ? "ดูรายละเอียด / ส่งคำขอใหม่" : "ดูสถานะการคืนเงิน"}<Icon name="chevron" size={16} />
                </Link>
            </section>
        );
    }
    if (!canRequest) return null;
    return (
        <Notice tone="neutral" icon="info">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">มีปัญหากับออเดอร์นี้? <Link href={href} className="font-semibold text-primary-dark underline">ขอคืนเงิน</Link></span>
        </Notice>
    );
}
