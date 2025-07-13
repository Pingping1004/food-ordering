"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";

function Page() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const orderId = searchParams.get('orderId');
    const chargeId = searchParams.get('chargeId');
    const qrImageUri = searchParams.get('qrImageUri');
    const errorRef = useRef(false);

    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    console.log('Qr URL: ', qrUrl);
    console.log('qrImageUri: ', qrImageUri);

    useEffect(() => {
        if (orderId && chargeId) {
            setQrUrl(qrImageUri);
            setIsLoading(false);
        }
    }, [orderId, chargeId]);

    const handlePayment = (async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/order/omise/complete?charge_id=${chargeId}&orderId=${orderId}`);
            const { status, redirectUrl, message } = response.data;
            console.log('Status: ', status);
            console.log('Redirect URL: ', redirectUrl);
            console.log('Message: ', message);
            alert(`${message}`)

            if (status === 'paid') {
                router.push(`${redirectUrl}`)
            }
        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string } } };
                console.error('Error: ', err.response.data?.message)
                if (!errorRef.current) {
                    errorRef.current = true;
                    alert(err.response.data?.message);
                }
            } else {
                if (!errorRef.current) {
                    errorRef.current = true;
                    alert('พบข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
                }
            }
        } finally {
            setIsLoading(false);
        }
    })

    if (isLoading) return <p className="text-gray-500">กำลังโหลด QR...</p>;
    if (!qrUrl) return <p>ไม่พบ QR สำหรับการชำระเงิน</p>

    return (
        <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gray-50">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                <h1 
                    className="noto-sans-bold text-xl text-red-500 mb-6"
                >กรุณาอย่ารีเฟรช กดย้อนกลับ หรือปิดเว็บไซต์จนกว่าจะได้รับสถานะชำระเงินสำเร็จ
                </h1>
                <h1 className="text-2xl text-primary noto-sans-bold mb-2">ชำระเงินด้วย PromptPay</h1>
                <p className="text-base text-light mb-4">
                    สั่งซื้อหมายเลข: <span className="noto-sans-regular text-base text-light">{orderId?.substring(0, 4)}</span>
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
                        <p className="text-xl text-secondary mb-2">
                            กรุณาสแกน QR นี้ด้วยแอป Mobile Banking เพื่อชำระเงิน
                        </p>
                        <p className="text-sm text-light">ระบบจะตรวจสอบการชำระเงินโดยอัตโนมัติ</p>
                    </>
                ) : (
                    <p className="text-red-500 text-xl">ไม่สามารถโหลด QR ได้ กรุณาลองใหม่อีกครั้ง</p>
                )}
                <Button
                    type="button"
                    size="full"
                    onClick={() => handlePayment()}
                    className="mt-10"
                    disabled={isLoading}
                >
                    ชำระเงินแล้ว
                </Button>
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