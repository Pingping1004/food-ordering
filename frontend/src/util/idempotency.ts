export const getIdempotencyKey = (orderId: string) => {
    const keyName = `idempotencyKey:${orderId}`;
    const raw = localStorage.getItem(keyName);

    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Date.now() < parsed.expiredAt) {
                return parsed.value;
            }
        } catch {}
    }

    const newKey = crypto.randomUUID();

    localStorage.setItem(
        keyName,
        JSON.stringify({
            value: newKey,
            expiredAt: Date.now() + 5 * 60 * 1000
        })
    );

    return newKey;
}

const SUBMIT_KEY = "orderSubmitKey";

/**
 * Idempotency-Key for POST /order/create. The same cart (same signature) reuses one key for 5 minutes, so a
 * double-tap, a retry after a timeout, or a resubmit after a flaky network cannot create a second order.
 * A changed cart gets a fresh key. Call clearOrderSubmitKey() once the order exists.
 */
export const getOrderSubmitKey = (signature: string): string => {
    try {
        const raw = sessionStorage.getItem(SUBMIT_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.signature === signature && Date.now() < parsed.expiredAt) return parsed.value;
        }
    } catch { /* storage blocked or corrupt: fall through to a fresh key */ }

    const value = crypto.randomUUID();
    try {
        sessionStorage.setItem(SUBMIT_KEY, JSON.stringify({ value, signature, expiredAt: Date.now() + 5 * 60 * 1000 }));
    } catch { /* ignore */ }
    return value;
};

export const clearOrderSubmitKey = () => {
    try { sessionStorage.removeItem(SUBMIT_KEY); } catch { /* ignore */ }
};
