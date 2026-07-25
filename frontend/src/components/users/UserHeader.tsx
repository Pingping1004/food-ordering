import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import { useAuth } from "@/auth/auth.hooks";
import { api } from "@/lib/api";
import axios from "axios";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";

export default function UserHeader() {
    const router = useRouter();
    const { user, logout } = useAuth();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localPending, setLocalPending] = useState(false);

    const pendingRequest = user?.roleRequest?.status === 'pending';

    useEffect(() => {
        setLocalPending(pendingRequest);
    }, [pendingRequest]);

    const primaryAction = useMemo(() => {
        if (!user) {
            return {
                label: 'เข้าสู่ระบบ',
                disabled: false,
                onClick: () => router.push('/login'),
            };
        }

        if (user.role === 'admin') {
            return {
                label: 'จัดการคำขอร้านอาหาร',
                disabled: false,
                onClick: () => router.push('/admin/role-requests'),
            };
        }

        if (user.role === 'cooker') {
            const restaurantId = user.restaurant?.restaurantId;
            return {
                label: restaurantId ? 'ร้านของฉัน' : 'ลงทะเบียนร้านอาหาร',
                disabled: false,
                onClick: () => {
                    if (restaurantId) router.push(`/cooker/${restaurantId}`);
                    else router.push(`/cooker/restaurant-register/${user.userId}`);
                },
            };
        }

        // Normal user
        return {
            label: localPending ? 'รอการอนุมัติจากแอดมิน' : 'ขอเป็นร้านอาหาร',
            disabled: localPending,
            onClick: async () => {
                if (localPending || isSubmitting) return;
                setIsSubmitting(true);
                try {
                    await api.post('/user/request-role', { role: 'cooker' });
                    setLocalPending(true);
                    toastSuccess('ส่งคำขอเป็นร้านอาหารแล้ว กรุณารอการอนุมัติจากแอดมิน');
                } catch (err) {
                    if (axios.isAxiosError(err)) {
                        const backendMessage = err.response?.data?.message;
                        if (typeof backendMessage === 'string') {
                            // Backend already says the request is pending
                            toastDanger(backendMessage);
                            if (backendMessage.includes('already sent')) {
                                setLocalPending(true);
                            }
                        } else {
                            toastDanger('ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
                        }
                    } else {
                        toastDanger('ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
                    }
                } finally {
                    setIsSubmitting(false);
                }
            },
        };
    }, [user, router, localPending, isSubmitting]);

    return (
        <header className="flex justify-between items-center">
            <h1 className="font-noto-thai font-bold text-xl">วันนี้กินอะไรดี?</h1>

            {user ? (
                <div className="flex justify-between gap-x-2">
                    <Button
                        size="md"
                        type="button"
                        variant="tertiary"
                        onClick={primaryAction.onClick}
                        disabled={primaryAction.disabled || isSubmitting}
                    >
                        {primaryAction.label}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondaryDanger"
                        onClick={() => logout()}
                    >
                        ล็อกเอาท์
                    </Button>
                </div>
            ) : (
                <div className="flex gap-x-2">
                    <Button
                    type="button"
                    onClick={primaryAction.onClick}
                >
                    {primaryAction.label}
                </Button>

                <Button
                    type="button"
                    variant="secondaryDanger"
                    onClick={() => window.open("https://forms.gle/mmPg4uSpEsapLcPHA")}
                >
                    รายงานปัญหา
                </Button>
                </div>
            )}
        </header >
    );
}
