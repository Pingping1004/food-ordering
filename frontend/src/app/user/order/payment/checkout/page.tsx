"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";

function Page() {
    const searchParams = useSearchParams();

    const orderId = searchParams.get('orderId');
    const chargeId = searchParams.get('chargeId');
    const qrImageUri = searchParams.get('qrImageUri');

    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (orderId && chargeId) {
            setQrUrl(qrImageUri);
            setIsLoading(false);

            const interval = setInterval(async () => {
                try {
                    await api.get(`/order/omise/complete?orderId=${orderId}&charge_id=${chargeId}`);
                } catch (error: unknown) {
                    if (typeof error === 'object' && error !== null && 'response' in error) {
                        const err = error as { response: { status: number; data?: { message?: string } } };
                        alert(err.response.data?.message);
                    } else {
                        alert(`พบข้อผิดพลาด กรุณาลองใหม่อีกครั้ง`);
                    }
                }
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [orderId, chargeId]);

    if (isLoading) return <p className="text-gray-500">กำลังโหลด QR...</p>;
    if (!qrUrl) return <p>ไม่พบ QR สำหรับการชำระเงิน</p>

    return (
        <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gray-50">
            <div className="bg-white p-6 rounded-2xl shadow-lg max-w-md w-full text-center">
                <h1 className="text-xl font-semibold text-gray-800 mb-2">ชำระเงินด้วย PromptPay</h1>
                <p className="text-sm text-gray-500 mb-4">
                    สั่งซื้อหมายเลข: <span className="font-medium text-black">{orderId}</span>
                </p>

                {qrUrl ? (
                    <>
                        <div className="flex justify-center mb-4">
                            <Image
                                src={qrUrl}
                                alt="PromptPay QR"
                                width={240}
                                height={240}
                                className="rounded-lg"
                            />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                            กรุณาสแกน QR นี้ด้วยแอป Mobile Banking เพื่อชำระเงิน
                        </p>
                        <p className="text-xs text-gray-400">ระบบจะตรวจสอบการชำระเงินโดยอัตโนมัติ</p>
                    </>
                ) : (
                    <p className="text-red-500">ไม่สามารถโหลด QR ได้ กรุณาลองใหม่อีกครั้ง</p>
                )}
            </div>
        </main>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense>
            <Page />
        </Suspense>
    )
}