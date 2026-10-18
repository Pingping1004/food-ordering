import { OrderStatus, PaymentStatus } from '@prisma/client';

/**
 * How long a student screen should wait before re-checking its order, sent as the `X-Poll-After` header (seconds)
 * on `GET /order/:id/status`. The server owns this so intervals can be tuned, or every client slowed during a rush,
 * without shipping a new frontend: set `POLL_INTERVAL_SCALE` (e.g. 1.5) and restart. 0 = stop polling.
 *
 *  - waiting for the shop to accept → 5 s, or 10 s when the client has push on (the "accepted" push is the fast path)
 *  - accepted, waiting for payment  → 20 s (the payment page itself does not poll; this is the shop-list card)
 *  - cooking / delayed              → 15 s (the "ready" / "delay" push refreshes at once)
 *  - ready for pickup               → 10 s
 *  - done, rejected, cancelled, refunded → 0 (nothing more can change)
 * Clients add ±20 % jitter, so students who ordered in the same second do not poll in the same second forever.
 */
export type PollState = {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  acceptAt: Date | null;
};

export const MIN_POLL_S = 3;
export const MAX_POLL_S = 60;

export function basePollSeconds(o: PollState, pushEnabled: boolean): number {
  if (
    o.status === OrderStatus.rejected ||
    o.status === OrderStatus.done ||
    o.paymentStatus === PaymentStatus.CANCELLED ||
    o.paymentStatus === PaymentStatus.REFUNDED
  )
    return 0;
  if (o.paymentStatus !== PaymentStatus.PAID) {
    const accepted = !!o.acceptAt || o.status !== OrderStatus.receive;
    if (accepted) return 20;
    return pushEnabled ? 10 : 5;
  }
  if (o.status === OrderStatus.ready) return 10;
  return 15; // receive (paid, legacy) | cooking | delay
}

export function pollScale(raw = process.env.POLL_INTERVAL_SCALE): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 1;
}

export function pollAfterSeconds(o: PollState, pushEnabled: boolean): number {
  const base = basePollSeconds(o, pushEnabled);
  if (base === 0) return 0;
  return Math.min(
    MAX_POLL_S,
    Math.max(MIN_POLL_S, Math.round(base * pollScale())),
  );
}
