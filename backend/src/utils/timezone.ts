export function toThaiDate(date: Date): Date {
    const result = new Date(date.getTime());

    Object.defineProperty(result, 'toJSON', {
        value: function () {
            const thaiOffsetMs = 7 * 60 * 60 * 1000;
            return new Date(this.getTime() + thaiOffsetMs)
                .toISOString()
                .replace('Z', '+07:00');
        },
        enumerable: false,
        writable: true,
        configurable: true,
    });

    return result;
}