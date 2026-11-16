/**
 * Payment Gateway & Online Checkout Types
 * Specified in PRD Module 12 (Finance Operations), §12.2 & §14.2
 */

export type PaymentGatewayProvider = "stripe" | "razorpay" | "mock";

export interface CheckoutSession {
  id: string;
  tenantId: string;
  invoiceId: string;
  provider: PaymentGatewayProvider;
  amountCents: number;
  currency: string;
  checkoutUrl: string;
  status: "pending" | "completed" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface CreateCheckoutInput {
  tenantId: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  provider: PaymentGatewayProvider;
  customerEmail?: string;
  returnUrl?: string;
}

export interface PaymentLinkTokenPayload {
  invoiceId: string;
  tenantId: string;
  amountCents: number;
  currency: string;
  expiresAt: number; // Unix timestamp
}

export interface ProcessedGatewayPayment {
  id: string;
  tenantId: string;
  invoiceId: string;
  provider: PaymentGatewayProvider;
  transactionReference: string;
  amountCents: number;
  currency: string;
  method: "card" | "upi" | "bank_transfer";
  status: "succeeded" | "failed";
  paidAt: string;
}
