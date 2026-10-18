import type { Order, OrderStatus, PaymentStatus } from "@/lib/schema";

/**
 * Student order lifecycle (schema.prisma + design: confirm → PAY → track → pick up):
 *
 *   create        status=receive  UNPAID  acceptAt=null         → /wait     (waiting for the shop to accept)
 *   accepted      status=receive  UNPAID  acceptAt=set          → /payment  (auto-accept skips the wait)
 *   slip verified status=cooking  PAID                          → /wait     (cooking starts by itself)
 *   cooking/delay                 PAID                          → /wait
 *   ready                         PAID                          → /done  ("พร้อมรับ" screen)
 *   done                          PAID                          → /done  (picked up)
 *   rejected / unpaid-expired     any                           → /failed
 *
 * Every student screen asks `routeForOrder()` where it belongs, so a refresh or a push-notification tap
 * always lands on the right step.
 */
export type StudentOrder = Omit<Order, "status"> & {
    status: OrderStatus | LegacyStatus;
    restaurant?: {
        name?: string;
        location?: string | null;
        paymentQr?: string;
        accountName?: string;
        contactTel?: string | null;
        /** pre-migration field */
        adminTel?: string | null;
    };
    /** pre-migration field name for `pickupAt` */
    deliverAt?: string;
    acceptAt?: string | null;
    readyAt?: string | null;
};

/** Values the pre-migration API may still return until the backend rows are converted. */
export type LegacyStatus = "sent" | "accepted" | "completed" | "cancelled";

const LEGACY: Record<LegacyStatus, OrderStatus> = { sent: "receive", accepted: "cooking", completed: "done", cancelled: "rejected" };
export const normalizeStatus = (s: OrderStatus | LegacyStatus): OrderStatus => (s in LEGACY ? LEGACY[s as LegacyStatus] : (s as OrderStatus));

/** Legacy payment values were lower case ("paid" | "unpaid" …). */
export const normalizePayment = (p: string): PaymentStatus => p.toUpperCase() as PaymentStatus;

export const pickupAtOf = (o: Pick<StudentOrder, "pickupAt" | "deliverAt">) => o.pickupAt ?? o.deliverAt ?? "";
export const restaurantTelOf = (o: StudentOrder) => o.restaurant?.contactTel ?? o.restaurant?.adminTel ?? null;

export type StudentScreen = "payment" | "wait" | "done" | "failed";

type FlowOrder = Pick<StudentOrder, "status" | "paymentStatus"> & { acceptAt?: string | null };

export function screenForOrder(o: FlowOrder): StudentScreen {
    const status = normalizeStatus(o.status);
    const pay = normalizePayment(o.paymentStatus);

    if (status === "rejected" || pay === "CANCELLED") return "failed";
    if (pay === "REFUNDED") return "failed";
    // Pay only after the shop accepted (orders that already moved past `receive` count as accepted).
    if (pay !== "PAID") return o.acceptAt || status !== "receive" ? "payment" : "wait"; // payment: UNPAID, PENDING_VERIFICATION, FAILED (can resend a slip until the window closes)
    if (status === "ready" || status === "done") return "done";
    return "wait"; // receive | cooking | delay
}

export const routeForOrder = (orderId: string, o: FlowOrder) => `/user/order/${screenForOrder(o)}/${orderId}`;

/** Students have 5 minutes to pay, counted from when the shop accepted; the backend then closes the order. */
export const PAYMENT_WINDOW_MINS = 3;
export const paymentDeadline = (o: Pick<StudentOrder, "orderAt" | "acceptAt">) => new Date(new Date(o.acceptAt ?? o.orderAt).getTime() + PAYMENT_WINDOW_MINS * 60 * 1000);

/** Timeline shown on the tracking screen. */
export const TIMELINE = ["ส่งออเดอร์แล้ว", "ร้านรับออเดอร์", "จ่ายเงินแล้ว · ตรวจสลิปผ่าน", "กำลังทำอาหาร", "พร้อมรับ"] as const;

/** Timeline labels for this order: the payment step says what is true right now (pay / verifying / paid). */
export function timelineLabels(o: Pick<StudentOrder, "paymentStatus">): string[] {
    const pay = normalizePayment(o.paymentStatus);
    const paymentLabel =
        pay === "PAID" ? TIMELINE[2]
        : pay === "PENDING_VERIFICATION" ? "ส่งสลิปแล้ว · กำลังตรวจสอบ"
        : "รอชำระเงิน · กรุณาชำระเงิน";
    return TIMELINE.map((label, i) => (i === 2 ? paymentLabel : label));
}

/** Index of the step that is "now" (0-based). Steps before it are done, after it are todo. */
export function timelineIndex(o: FlowOrder): number {
    const status = normalizeStatus(o.status);
    if (normalizePayment(o.paymentStatus) !== "PAID") return o.acceptAt ? 2 : 1;
    if (status === "receive" || status === "cooking" || status === "delay") return 3;
    return 4;
}

export const fmtTime = (iso: string | Date | undefined | null) =>
    iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }) : "";
