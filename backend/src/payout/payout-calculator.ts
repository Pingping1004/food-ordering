import { startOfWeek, endOfWeek, format } from "date-fns";
import Decimal from "decimal.js";

export interface PayoutCalculationType {
    totalRevenue: number;
    restaurantEarning: number;
    platformFee: number;
    grossPlatformCommission: number;
    transactionFee: number;
}

export interface WeeklyPayoutType {
    startDate: Date,
    endDate: Date,
    formattedStartDate: string,
    formattedEndDate: string,
}

const APP_TIMEZONE = 'Asia/Bangkok';

export function calculatePayout(totalPrice: number): PayoutCalculationType {
    const baseTransactionRate = new Decimal(Number(process.env.OMISE_BASE_TRANSACTION_RATE));
    const vatRate = new Decimal(Number(process.env.OMISE_VAT_RATE));
    const platformCommissionRate = new Decimal(Number(process.env.PLATFORM_COMMISSION_RATE));

    const userPaidAmountDecimal = new Decimal(totalPrice);

    // 1. Calculate Gross Platform Commission
    const grossPlatformCommission = userPaidAmountDecimal.times(platformCommissionRate);

    // 2. Calculate the Transaction Fee (including VAT)
    const baseFee = userPaidAmountDecimal.times(baseTransactionRate);
    const totalTransactionFee = baseFee.times(new Decimal(1).plus(vatRate));

    // 3. Calculate Restaurant's Net Earning
    const restaurantEarning = userPaidAmountDecimal.minus(grossPlatformCommission);

    // 4. Calculate Platform's Net Earning
    const platformNetEarning = grossPlatformCommission.minus(totalTransactionFee);

    const finalGrossPlatformCommission = grossPlatformCommission.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const finalTotalTransactionFee = totalTransactionFee.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const finalRestaurantEarning = restaurantEarning.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const finalPlatformNetEarning = platformNetEarning.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const finalUserPaidAmount = userPaidAmountDecimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(); // Ensure consistent rounding for total

    return {
        totalRevenue: finalUserPaidAmount,
        restaurantEarning: finalRestaurantEarning,
        platformFee: finalPlatformNetEarning,
        grossPlatformCommission: finalGrossPlatformCommission, // Expose gross for clarity/auditing
        transactionFee: finalTotalTransactionFee,
    };
}

export function calculateWeeklyInterval(rawDate?: Date | string): WeeklyPayoutType {
    let baseDate: Date;
    if (rawDate) {
        baseDate = typeof rawDate === 'string' ? new Date(rawDate) : rawDate;
    } else {
        baseDate = new Date();
    }

    const startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
    const endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
    const formattedStartDate = format(startDate, 'dd/MM/yy');
    const formattedEndDate = format(endDate, 'dd/MM/yy');

    return {
        startDate,
        endDate,
        formattedStartDate,
        formattedEndDate,
    }
}