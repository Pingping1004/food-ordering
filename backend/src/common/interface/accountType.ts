import { AccountType } from '@prisma/client';

type BankCode = (typeof BANK_CODE_MAP)[AccountType];
export interface PaymentPayload {
  payload: {
    imageBase64: string;

    checkCondition: {
      checkDuplicate: boolean;

      checkAmount: {
        type?: "eq" | "gte" | "lte";
        amount: string;
      };

      checkDate?: {
        type?: "eq" | "gte" | "lte";
        date?: Date;
      };

      checkReceiver?: {
        accountType?: BankCode;
        accountNumber?: string;
        accountNameTH?: string;
        accountNameEN?: string;
      }[];
    }
  }
}

export const BANK_CODE_MAP = {
  BANGKOK_BANK: "01002",
  KASIKORN_BANK: "01004",
  KRUNG_THAI_BANK: "01006",
  TTB: "01011",
  SCB: "01014",
  KRUNGSRI: "01025",
  KKP: "01069",
  CIMB_THAI: "01022",
  TISCO: "01067",
  UOB: "01024",
  THAI_CREDIT: "01071",
  LH_BANK: "01073",
  ICBC_THAI: "01070",
  SME_BANK: "01098",
  BAAC: "01034",
  EXIM: "01035",
  GSB: "01030",
  GHB: "01033",
  ISLAMIC_BANK: "01066",

  PROMPTPAY_PHONE: "02001",
  PROMPTPAY_ID: "02003",
  PROMPTPAY_EWALLET: "02004",

  MERCHANT_QR: "03000",
  TRUEMONEY_WALLET: "04000",
} satisfies Record<AccountType, string>;

const CODE_TO_ENUM: Record<string, AccountType> = Object.fromEntries(
  Object.entries(BANK_CODE_MAP).map(([key, value]) => [value, key])
) as Record<string, AccountType>;

export const toAccountType = (value: string): AccountType | null => {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (Object.values(toAccountType).includes(value as AccountType)) return value as AccountType;

  if (CODE_TO_ENUM[value]) return CODE_TO_ENUM[value];
  if (BANK_CODE_MAP[normalized]) return BANK_CODE_MAP[normalized];

  return null;
};