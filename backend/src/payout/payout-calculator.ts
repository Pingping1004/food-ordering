import { startOfWeek, endOfWeek, format } from 'date-fns';
import Decimal from 'decimal.js';

const envBaseTransactionRate = new Decimal(process.env.TRANSACTION_RATE || "0");
const envVatRate = new Decimal(process.env.VAT_RATE || "0");
const envCommissionRate = new Decimal(process.env.PLATFORM_COMMISSION_RATE || "0");

export interface PayoutCalculationType {
  totalRevenue: number | Decimal;
  restaurantEarning: number | Decimal;
  platformNetEarning: number | Decimal;
  grossPlatformCommission: number | Decimal;
  transactionFee: number | Decimal;
  vatRate: number | Decimal;
}

export interface WeeklyPayoutType {
  startDate: Date;
  endDate: Date;
  formattedStartDate: string;
  formattedEndDate: string;
}

export function calculatePayout(
  totalPrice: Decimal, 
  platformCommissionRate: Decimal = envCommissionRate, 
  baseTransactionRate: Decimal = envBaseTransactionRate, 
  vatRate: Decimal = envVatRate
): PayoutCalculationType {

  const userPaidAmount = totalPrice;
  const transactionFee = new Decimal(process.env.PAYMENT_VERIFICATION_API_FEE ?? '0')

  // const grossPlatformCommission = userPaidAmount.mul(config.platformCommissionRate);
  // const baseFee = userPaidAmount.mul(config.baseTransactionRate);
  // const totalTransactionFee = baseFee.mul(new Decimal(1).plus(config.vatRate));
  // const restaurantEarning = userPaidAmount.minus(grossPlatformCommission);
  // const platformNetEarning = grossPlatformCommission.minus(totalTransactionFee);
  // const platformNetEarning = userPaidAmount.minus(transactionFee);
  const restaurantEarning = userPaidAmount;
  const platformNetEarning = transactionFee.neg()

  // if (platformNetEarning.isNegative()) throw new Error("Invalid pricing: platform losing money");

  return {
    totalRevenue: userPaidAmount.toDecimalPlaces(2),
    // restaurantEarning: restaurantEarning.toDecimalPlaces(2),
    restaurantEarning: restaurantEarning.toDecimalPlaces(2),
    platformNetEarning: platformNetEarning.toDecimalPlaces(2),
    grossPlatformCommission: new Decimal(0),
    transactionFee: transactionFee.toDecimalPlaces(2),
    vatRate: totalPrice.mul(vatRate).toDecimalPlaces(2)
  };
}

export function calculateWeeklyInterval(
  rawDate?: Date | string,
): WeeklyPayoutType {
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
  };
}
