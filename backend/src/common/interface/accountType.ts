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
  | "01030" // Government Savings Bank
  | "01033" // Government Housing Bank
  | "01066" // Islamic Bank of Thailand
  | "02001" // PromptPay (Phone Number)
  | "02003" // PromptPay (Citizen ID / Tax ID)
  | "02004" // PromptPay (E-Wallet)
  | "03000" // Merchant QR (K+ Shop, Mae Manee, Be Merchant, TTB Smart Shop)
  | "04000"; // TrueMoney Wallet

  export interface PaymentPayload {
    payload: {
        qrCode: string;
  
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