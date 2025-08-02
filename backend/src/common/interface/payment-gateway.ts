import { PaymentMethod, PaymentStatus } from "@prisma/client";

export interface PaymentPayload {
  userId?: string;
  orderId: string;
  amountInStang: number;
  currency?: string;
  userEmail: string;
  method?: PaymentMethod;
  description?: string;
  restaurantId: string;
}

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  transactionId?: string;
  rawResponse?: any;
  error?: string;
}

export interface PaymenetGateWay {
  createPayment(req: PaymentPayload): Promise<PaymentResult>;
  verifyWebhook(req: any): Promise<any>;
  handleWebhookEvent(data: any): Promise<void>;
  getTransactionStatus(transactionId: string): Promise<PaymentStatus>;
}

export interface PromptPayQrResponse {
  qrCodeData: string;
  paymentGatewayChargeId
}