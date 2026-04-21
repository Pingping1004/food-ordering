export const getIdempotencyKey = (orderId: string) => {
    const keyName = `idempotencyKey: ${orderId}`;
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