"use client"

import { Button } from "@/components/Button"
import { toastDanger, toastSuccess } from "@/components/ui/Toast"
import { api } from "@/lib/api"
import { getParamId } from "@/util/param"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

export default function RefundRequestPage() {
    const params = useParams();
    const router = useRouter()
    const [loading, setLoading] = useState(false);

    const orderId = getParamId(params.orderId)

    const handleSubmitCancel = async () => {
        try {
            setLoading(true)

            const orderSecret = localStorage.getItem(`orderSecret:${orderId}`)
            await api.patch(`order/cancel/${orderId}`, { orderSecret })

            router.push(`/user/order/refund/${orderId}`)
        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };
                const backendMessage = err.response.data?.message;

                toastDanger(backendMessage ?? "เกิดข้อผิดพลาดในการยกเลิกออเดอร์");
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-lg mx-auto p-6 space-y-6">

            <h1 className="text-2xl noto-sans-bold">
                ขอคืนเงิน
            </h1>

            <p className="text-secondary">หากออเดอร์ของคุณถูกยกเลิกหรือคุณยกเลิกออเดอร์ คุณสามารถขอคืนเงินได้ผ่านแบบฟอร์มด้านล่าง</p>

            <a
                href="https://forms.gle/irnHUceo7qwFzZ8z5"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center border border-primary-main text-primary-main py-3 rounded-lg"
            >
                เปิดแบบฟอร์มขอคืนเงิน
            </a>

            <Button
                onClick={handleSubmitCancel}
                disabled={loading}
                type="button"
                size="full"
                variant="primary"
            >
                {loading ? "กำลังส่งคำขอ..." : "ฉันได้กรอกแบบฟอร์มแล้ว"}
            </Button>

        </div>
    )
}