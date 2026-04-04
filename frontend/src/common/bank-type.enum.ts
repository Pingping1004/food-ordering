export const BANKS = {
  "01002": { label: "ธนาคารกรุงเทพ (Bangkok Bank)", group: "bank" },
  "01004": { label: "ธนาคารกสิกรไทย (KBank)", group: "bank" },
  "01006": { label: "ธนาคารกรุงไทย (Krungthai)", group: "bank" },
  "01011": { label: "ธนาคารทหารไทยธนชาต (TTB)", group: "bank" },
  "01014": { label: "ธนาคารไทยพาณิชย์ (SCB)", group: "bank" },
  "01025": { label: "ธนาคารกรุงศรีอยุธยา (Krungsri)", group: "bank" },
  "01069": { label: "ธนาคารเกียรตินาคินภัทร (KKP)", group: "bank" },
  "01022": { label: "ธนาคารซีไอเอ็มบี ไทย (CIMB Thai)", group: "bank" },
  "01067": { label: "ธนาคารทิสโก้ (TISCO)", group: "bank" },
  "01024": { label: "ธนาคารยูโอบี (UOB)", group: "bank" },
  "01071": { label: "ธนาคารไทยเครดิต (Thai Credit)", group: "bank" },
  "01073": { label: "ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)", group: "bank" },
  "01070": { label: "ธนาคารไอซีบีซี (ICBC Thai)", group: "bank" },
  "01098": { label: "ธนาคาร SME", group: "bank" },
  "01034": { label: "ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)", group: "bank" },
  "01035": { label: "ธนาคารเพื่อการส่งออกและนำเข้า (EXIM)", group: "bank" },
  "01030": { label: "ธนาคารออมสิน (GSB)", group: "bank" },
  "01033": { label: "ธนาคารอาคารสงเคราะห์ (GHB)", group: "bank" },
  "01066": { label: "ธนาคารอิสลามแห่งประเทศไทย", group: "bank" },

  "02001": { label: "PromptPay (เบอร์โทร)", group: "promptpay" },
  "02003": { label: "PromptPay (เลขบัตรประชาชน / ภาษี)", group: "promptpay" },
  "02004": { label: "PromptPay (E-Wallet)", group: "promptpay" },

  "03000": { label: "Merchant QR (K+ Shop, แม่มณี, Be Merchant, TTB)", group: "other" },
  "04000": { label: "TrueMoney Wallet", group: "other" },
} as const;

export type AccountTypeCode = keyof typeof BANKS;
export const ACCOUNT_TYPES = Object.keys(BANKS) as AccountTypeCode[];
export const ACCOUNT_TYPE_OPTIONS = [
  // PromptPay
  ...Object.entries(BANKS)
    .filter(([_, v]) => v.group === "promptpay")
    .map(([value, v]) => ({ value, key: v.label })),

  { value: "divider-1", key: "──────────" },

  // Banks
  ...Object.entries(BANKS)
    .filter(([_, v]) => v.group === "bank")
    .map(([value, v]) => ({ value, key: v.label })),

  { value: "divider-2", key: "──────────" },

  // Others
  ...Object.entries(BANKS)
    .filter(([_, v]) => v.group === "other")
    .map(([value, v]) => ({ value, key: v.label })),
];