import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toastDanger } from '@/components/ui/Toast';
import { OrderStatus } from '@/components/cookers/OrderNavbar';

export default function useOrderStatusPolling(orderId: string, currentStatus: string) {
    const [, setOrderStatus] = useState<OrderStatus>();
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pollOrderStatus = async () => {
      try {
        const res = await api.get(`/order/${orderId}`);
        const data = await res.data;

        if (data.status !== currentStatus) {
          // Update local state
          setOrderStatus(data.status);

          // Redirect if accepted
          if (data.status === 'ACCEPTED' && data.paymentUrl) {
            router.push(data.paymentUrl);
          }

          // Handle reject / toast if needed
          if (data.status === 'REJECTED') {
            toastDanger("ออเดอร์ถูกปฏิเสธ");
          }
        }
      } catch (err) {
        console.error("Polling failed:", err);
      }
    };

    intervalRef.current = setInterval(pollOrderStatus, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId, currentStatus]);
}