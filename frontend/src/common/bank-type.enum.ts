export const BANKS = {
  // ===== Banks =====
  BANGKOK_BANK: {
    code: "01002",
    label: "ธนาคารกรุงเทพ (Bangkok Bank)",
    group: "bank"
  },
  KASIKORN_BANK: {
    code: "01004",
    label: "ธนาคารกสิกรไทย (KBank)",
    group: "bank"
  },
  KRUNG_THAI_BANK: {
    code: "01006",
    label: "ธนาคารกรุงไทย (Krungthai)",
    group: "bank"
  },
  TTB: {
    code: "01011",
    label: "ธนาคารทหารไทยธนชาต (TTB)",
    group: "bank"
  },
  SCB: {
    code: "01014",
    label: "ธนาคารไทยพาณิชย์ (SCB)",
    group: "bank"
  },
  KRUNGSRI: {
    code: "01025",
    label: "ธนาคารกรุงศรีอยุธยา (Krungsri)",
    group: "bank"
  },
  KKP: {
    code: "01069",
    label: "ธนาคารเกียรตินาคินภัทร (KKP)",
    group: "bank"
  },
  CIMB_THAI: {
    code: "01022",
    label: "ธนาคารซีไอเอ็มบี ไทย (CIMB Thai)",
    group: "bank"
  },
  TISCO: {
    code: "01067",
    label: "ธนาคารทิสโก้ (TISCO)",
    group: "bank"
  },
  UOB: {
    code: "01024",
    label: "ธนาคารยูโอบี (UOB)",
    group: "bank"
  },
  THAI_CREDIT: {
    code: "01071",
    label: "ธนาคารไทยเครดิต (Thai Credit)",
    group: "bank"
  },
  LH_BANK: {
    code: "01073",
    label: "ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)",
    group: "bank"
  },
  ICBC_THAI: {
    code: "01070",
    label: "ธนาคารไอซีบีซี (ICBC Thai)",
    group: "bank"
  },
  SME_BANK: {
    code: "01098",
    label: "ธนาคาร SME",
    group: "bank"
  },
  BAAC: {
    code: "01034",
    label: "ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)",
    group: "bank"
  },
  EXIM: {
    code: "01035",
    label: "ธนาคารเพื่อการส่งออกและนำเข้า (EXIM)",
    group: "bank"
  },
  GSB: {
    code: "01030",
    label: "ธนาคารออมสิน (GSB)",
    group: "bank"
  },
  GHB: {
    code: "01033",
    label: "ธนาคารอาคารสงเคราะห์ (GHB)",
    group: "bank"
  },
  ISLAMIC_BANK: {
    code: "01066",
    label: "ธนาคารอิสลามแห่งประเทศไทย",
    group: "bank"
  },

  // ===== PromptPay =====
  PROMPTPAY_PHONE: {
    code: "02001",
    label: "PromptPay (เบอร์โทร)",
    group: "promptpay"
  },
  PROMPTPAY_ID: {
    code: "02003",
    label: "PromptPay (เลขบัตรประชาชน / ภาษี)",
    group: "promptpay"
  },
  PROMPTPAY_EWALLET: {
    code: "02004",
    label: "PromptPay (E-Wallet)",
    group: "promptpay"
  },

  // ===== Others =====
  MERCHANT_QR: {
    code: "03000",
    label: "Merchant QR (K+ Shop, แม่มณี, Be Merchant, TTB)",
    group: "other"
  },
  TRUEMONEY_WALLET: {
    code: "04000",
    label: "TrueMoney Wallet",
    group: "other"
  },
} as const;

export type AccountType = keyof typeof BANKS;
export type BankMeta = typeof BANKS[AccountType];
export const ACCOUNT_TYPES = Object.keys(BANKS) as AccountType[];
export const ACCOUNT_TYPE_OPTIONS = Object.entries(BANKS).map(
  ([key, value]) => ({
    key: value.label, 
    value: key,
  })
);