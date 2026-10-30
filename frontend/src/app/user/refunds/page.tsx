"use client";

import Link from "next/link";
import { StudentShell, StudentTopBar } from "@/components/users/StudentShell";
import { Card, EmptyState, ErrorState, Icon, OrderListSkeleton } from "@/components/ui/kit";
import { RefundStatusChip } from "@/components/refunds/RefundParts";
import { useMyRefunds } from "@/hook/useRefunds";
import { formatBaht, formatDateTime, orderCode, refundReasonLabel } from "@/lib/schema/format";

/** Every refund request the student has made, newest first, with the school's decision note. */
export default function MyRefundsPage() {
    const { data = [], isLoading, isError, refetch } = useMyRefunds();

    return (
        <StudentShell active="orders">
            <StudentTopBar title="คำขอคืนเงินของฉัน" backHref="/user/orders" />
            <main className="flex flex-col gap-3 p-4">
                {isLoading && <OrderListSkeleton count={3} />}
                {isError && <ErrorState onRetry={() => refetch()} />}
                {!isLoading && !isError && data.length === 0 && (
                    <EmptyState title="ยังไม่มีคำขอคืนเงิน" body="หากออเดอร์มีปัญหา เปิดออเดอร์ที่ผ่านมาแล้วกดขอคืนเงินได้" action={<Link href="/user/orders" className="inline-flex h-12 items-center rounded-xl bg-primary-main px-5 font-bold text-white">ไปที่ออเดอร์ของฉัน</Link>} />
                )}
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {data.map((r) => (
                        <Card as="li" key={r.id} className="p-0">
                            <Link href={`/user/order/refund/${r.orderId}`} className="flex flex-col gap-2 p-4">
                                <span className="flex items-center justify-between gap-2">
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                        <span className="truncate text-base font-bold">{r.restaurant?.name ?? "ออเดอร์"} · {orderCode(r.orderId)}</span>
                                        <span className="text-[13px] text-brand-muted">ส่งเมื่อ {formatDateTime(r.createdAt)}</span>
                                    </span>
                                    <RefundStatusChip status={r.status} short />
                                </span>
                                <span className="text-sm text-slate">{refundReasonLabel(r.reason)} · {formatBaht(r.amount)} บาท</span>
                                {r.decisionNote && <span className="rounded-xl bg-ground p-2.5 text-sm leading-relaxed">ร้าน: {r.decisionNote}</span>}
                                <span className="flex items-center gap-1 text-sm font-semibold text-primary-dark">ดูรายละเอียด<Icon name="chevron" size={16} /></span>
                            </Link>
                        </Card>
                    ))}
                </ul>
            </main>
        </StudentShell>
    );
}
