"use client";

import { Button } from "@/components/Button";
import LoadingPage from "@/components/LoadingPage";
import { toastDanger } from "@/components/ui/Toast";
import { getParamId } from "@/util/param";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Order } from "../../done/[orderId]/page";
import { api } from "@/lib/api";

export default function RefundProcessingPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    const orderId = getParamId(params.orderId);
    const [order, setOrder] = useState<Order>();
    const hasRedirectedRef = useRef<boolean>(false);

    const totalAmount = order?.totalAmount;

    useEffect(() => {
        localStorage.removeItem('activeOrderId');
    }, []);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
                const orderResponse = await api.get(`order/${orderId}`, {
                    headers: { "x-order-secret": orderSecret }
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
            <h1 className="text-2xl font-noto-thai text-bold text-primary">ส่งคำขอคืนเงินเรียบร้อย</h1>

            <p className="text-secondary">ระบบได้รับคำร้องของคุณแล้ว ทีมงานจะตรวจสอบและประสานงานกับร้านค้าให้</p>

            <div className="bg-gray-100 px-4 py-2 rounded-lg ">Order ID: <span className="font-medium">{orderId}</span></div>

            <p className="text-sm text-gray-500">
            กรุณาติดต่อร้านค้าโดยตรงเพื่อดำเนินการเรื่องการคืนเงิน
            หากมีข้อสงสัยสามารถ
                <a
                    href="https://forms.gle/BAciUJDqmALckUXY6"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info font-noto-thai text-bold text-xs underline hover:text-info"
                >ติดต่อแอดมินได้</a>
            </p>

            <section className="flex flex-col w-full justify-between gap-y-6">
                <p className="font-noto-thai text-bold text-lg text-primary">รายละเอียดออเดอร์</p>

                <div>
                    {order.orderMenus.map((item) => (
                        <div key={item.menuName} className="flex justify-between gap-y-2">
                            <p className="font-noto-thai text-lg text-primary">{item.quantity}x{' '}-{' '}{item.menuName}</p>
                            <p className="font-noto-thai text-bold text-2xl text-primary">{item.unitPrice * item.quantity}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="flex w-[calc(100%+3rem)] justify-between bg-primary-main text-white p-6 -mx-6">
                <h3 className="font-noto-thai text-bold text-2xl">ยอดรวมทั้งหมด</h3>
                <h3 className="font-noto-thai text-bold text-2xl">{totalAmount}</h3>
            </section>

            <div className="flex w-full gap-x-4">
                <Button
                    type="button"
                    variant="primary"
                    size="full"
                    onClick={() => router.push(`/user/restaurant`)}
                    className="px-4 py-2 rounded-lg border"
                >
                    กลับหน้าหลัก
                </Button>

                <Button
                    type="button"
                    variant="secondaryDanger"
                    size="full"
                    onClick={() => window.open("https://forms.gle/WDyouigQHP1KjfMS9")}
                    className="px-4 py-2 rounded-lg border"
                >
                    แจ้งปัญหาในการคืนเงิน
                </Button>
            </div>
        </div>
    );
}