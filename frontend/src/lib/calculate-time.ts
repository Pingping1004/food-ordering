export function estimateDelayBufferFromOrderAmount(orderAmount: number) {
    if (orderAmount >= 15) {
        return 15;
    } else if(orderAmount >= 10) {
        return 10;
    } else if (orderAmount >= 6) {
        return 8;
    } else if (orderAmount >= 4) {
        return 6;
    }

    return 0;
}

export function esimatedDeliveryTimeRange(avgCookingTime: number, orderAmount: number): { min: Date, max: Date } {
    const now = new Date();
    const extraBufferTime = avgCookingTime + estimateDelayBufferFromOrderAmount(orderAmount);
    const minimumAllowedDeliverTime = new Date(now.getTime() + extraBufferTime * 60 * 1000);
    const maxEstimatedDeliverTime = new Date(minimumAllowedDeliverTime.getTime() + 5 * 60 * 1000);

    return { min: minimumAllowedDeliverTime, max: maxEstimatedDeliverTime };
}