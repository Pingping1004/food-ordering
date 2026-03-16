"use client";

import { Button } from "@/components/Button";
import LoadingPage from "@/components/LoadingPage";
import { toastDanger } from "@/components/ui/Toast";
import { getParamId } from "@/util/param";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Order } from "../../done/[orderId]/page";
import { api } from "@/lib/api";
import clsx from "clsx";

export default function RefundProcessingPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    const orderId = getParamId(params.orderId);
    const [order, setOrder] = useState<Order>();
    const hasRedirectedRef = useRef<boolean>(false);

    const totalAmount = order?.totalAmount;
    const refundStatusText: Record<string, string> = {
        refund_pending: "กำลังดำเนินการคืนเงิน",
        refund_complete: "คืนเงินสำเร็จแล้ว"
    };

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
                console.log("orderSecret from localStorage:", orderSecret)
                const orderResponse = await api.get(`order/${orderId}`, {
                    headers: {
                        "x-order-secret": orderSecret
                    }
                });
                setOrder(orderResponse.data);

                if (orderResponse.data.isPaid === "unpaid" && !hasRedirectedRef.current) {
                    hasRedirectedRef.current = true;
                    toastDanger('กรุณาชำระเงินก่อน');
                    router.push(`/user/order/confirm/${orderId}`);
                    return;
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [orderId, router]);

    if (loading) return <LoadingPage />
    if (!order) return <div>ไม่พบออเดอร์ของคุณ</div>;

    return (
        <div className="flex flex-col w-full mx-auto p-6 items-center text-center space-y-8">

            <h1 className="text-xl noto-sans-bold text-primary">ส่งคำขอคืนเงินเรียบร้อย</h1>

            <p className="text-secondary">ระบบได้รับคำขอคืนเงินของคุณแล้ว ทีมงานกำลังตรวจสอบและดำเนินการคืนเงินให้คุณ</p>

            <div className="bg-gray-100 px-4 py-2 rounded-lg text-base">Order ID: <span className="font-medium">{orderId}</span></div>

            <p className="text-sm text-gray-500">
                ระบบจะคืนเงินภายใน24ชั่วโมง หากมีข้อสงสัยสามารถ
                <a
                    href="https://forms.gle/BAciUJDqmALckUXY6"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info noto-sans-bold text-xs underline hover:text-info"
                >ติดต่อแอดมินได้</a>
            </p>

            <main 
            className={clsx("text-3xl noto-sans-bold py-4", 
                order.paymentStatus === "refund_complete" ? "text-success-main" : "text-primary-main")}
            >
                สถานะ: {refundStatusText[order.paymentStatus] ?? "กำลังตรวจสอบการคืนเงิน"}
            </main>

            <section className="flex flex-col w-full justify-between gap-y-6">
                <p className="noto-sans-bold text-lg text-primary">รายละเอียดออเดอร์</p>

                <div>
                    {order.orderMenus.map((item) => (
                        <div key={item.menuName} className="flex justify-between gap-y-2">
                            <p className="noto-sans-regular text-lg text-primary">{item.quantity}x{' '}-{' '}{item.menuName}</p>
                            <p className="noto-sans-bold text-2xl text-primary">{item.unitPrice * item.quantity}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="flex w-[calc(100%+3rem)] justify-between bg-primary-main text-white p-6 -mx-6">
                <h3 className="noto-sans-bold text-2xl">ยอดรวมทั้งหมด</h3>
                <h3 className="noto-sans-bold text-2xl">{totalAmount}</h3>
            </section>

            <Button
                type="button"
                variant="secondary"
                size="full"
                onClick={() => router.push(`/user/restaurant`)}
                className="px-4 py-2 rounded-lg border"
            >
                กลับหน้าหลัก
            </Button>

        </div>
    );
}