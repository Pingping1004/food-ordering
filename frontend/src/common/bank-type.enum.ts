export enum OmiseBankType {
  // Mobile Banking Apps
  KBank = 'kbank',
  BangkokBank = 'bbl',
  SCB = 'scb',
  Krungsri = 'krungsri',
  Krungthai = 'krungthai',

  // Other types if you support them, e.g., PromptPay
  PromptPay = 'promptpay',
}

export const OMISE_BANK_TYPE_VALUES = Object.values(OmiseBankType);