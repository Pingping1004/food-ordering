import { startOfWeek, endOfWeek, format } from "date-fns";

export interface PayoutCalculationType {
    totalRevenue: number;
    restaurantEarning: number;
    platformFee: number;
}

export interface WeeklyPayoutType {
    startDate: Date,
    endDate: Date,
    formattedStartDate: string,
    formattedEndDate: string,
}

export function calculatePayout(totalPrice: number, platformFeeRate = 0.1): PayoutCalculationType {
    const platformFee = Math.floor(totalPrice * platformFeeRate);
    const restaurantEarning = totalPrice - platformFee;

    return {
        totalRevenue: totalPrice,
        restaurantEarning,
        platformFee,
    };
}

export function calculateWeeklyInterval(rawDate?: Date | string): WeeklyPayoutType {
    let date: Date;
    if (rawDate) {
        date = typeof rawDate === 'string' ? new Date(rawDate) : rawDate;
    } else {
        date = new Date();
    }
    const startDate = startOfWeek(date, { weekStartsOn: 1 });
    const endDate = endOfWeek(date, { weekStartsOn: 1 });
    const formattedStartDate = format(startDate, 'dd/MM/yy');
    const formattedEndDate = format(endDate, 'dd/MM/yy');

    return {
        startDate,
        endDate,
        formattedStartDate,
        formattedEndDate,
    }
}