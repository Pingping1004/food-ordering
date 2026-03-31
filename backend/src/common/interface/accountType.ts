export type AccountType =
  | "01002" // Bangkok Bank
  | "01004" // Kasikorn Bank
  | "01006" // Krung Thai Bank
  | "01011" // TMB Thanachart Bank
  | "01014" // Siam Commercial Bank (SCB)
  | "01025" // Krungsri Bank
  | "01069" // Kiatnakin Phatra Bank
  | "01022" // CIMB Thai Bank
  | "01067" // TISCO Bank
  | "01024" // UOB Bank
  | "01071" // Thai Credit Bank
  | "01073" // Land and Houses Bank
  | "01070" // ICBC Thai
  | "01098" // SME Bank
  | "01034" // BAAC
  | "01035" // EXIM Bank
  | "01030" // Government Savings Bank(Aomsin)
  | "01033" // Government Housing Bank(ธอส)
  | "01066" // Islamic Bank of Thailand
  | "02001" // PromptPay (Phone Number)
  | "02003" // PromptPay (Citizen ID / Tax ID)
  | "02004" // PromptPay (E-Wallet)
  | "03000" // Merchant QR (K+ Shop, Mae Manee, Be Merchant, TTB Smart Shop)
  | "04000"; // TrueMoney Wallet

export interface PaymentPayload {
  payload: {
    imageBase64: string;

    checkCondition: {
      checkDuplicate: boolean;

      checkAmount: {
        type?: "eq" | "gte" | "lte";
        amount: string;
      };

      checkDate: {
        type?: "eq" | "gte" | "lte";
        date: Date;
      };

      checkReceiver?: {
        accountType?: AccountType;
        accountNumber: string;
        accountNameTH?: string;
        accountNameEN?: string;
      }[];
    }
  }
}

const BANK_NAME_MAP: Record<string, AccountType> = {
  // Thai names
  "กรุงเทพ": "01002",
  "กสิกร": "01004",
  "กสิกรไทย": "01004",
  "กรุงไทย": "01006",
  "ทหารไทยธนชาต": "01011",
  "ttb": "01011",
  "ไทยพาณิชย์": "01014",
  "scb": "01014",
  "กรุงศรี": "01025",
  "เกียรตินาคินภัทร": "01069",
  "cimb": "01022",
  "tisco": "01067",
  "uob": "01024",
  "ไทยเครดิต": "01071",
  "แลนด์แอนด์เฮ้าส์": "01073",
  "lh": "01073",
  "icbc": "01070",
  "sme": "01098",
  "ธกส": "01034",
  "เพื่อการส่งออก": "01035",
  "exim": "01035",
  "ออมสิน": "01030",
  "อาคารสงเคราะห์": "01033",
  "ธอส": "01033",
  "อิสลาม": "01066",
  "พร้อมเพย์": "02001",
  "truemoney": "04000",
  "ทรูมันนี่": "04000",
};

export const toAccountType = (value: string): AccountType | null => {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  const VALID_ACCOUNT_TYPES = new Set<AccountType>(Object.values(BANK_NAME_MAP));

  // direct code match e.g. "01004"
  if (VALID_ACCOUNT_TYPES.has(value as AccountType)) {
    return value as AccountType;
  }

  // name match e.g. "กสิกร", "SCB"
  return BANK_NAME_MAP[normalized] ?? BANK_NAME_MAP[value.trim()] ?? null;
};