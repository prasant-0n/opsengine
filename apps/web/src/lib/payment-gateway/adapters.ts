import { randomUUID } from "node:crypto";
import { CheckoutSession, CreateCheckoutInput } from "./types";
import { verifyStripeSignature, verifyRazorpaySignature } from "./signatures";

export interface GatewayWebhookEvent {
  eventType: string;
  invoiceId: string;
  tenantId: string;
  amountCents: number;
  currency: string;
  transactionReference: string;
  method: "card" | "upi" | "bank_transfer";
  status: "succeeded" | "failed";
}

export interface PaymentGatewayAdapter {
  createSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, signature: string, secret: string): boolean;
  parseWebhook(rawBody: string): GatewayWebhookEvent;
}

export class StripeAdapter implements PaymentGatewayAdapter {
  public async createSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const sessionId = `cs_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;

    return {
      id: sessionId,
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      provider: "stripe",
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      checkoutUrl,
      status: "pending",
      expiresAt,
      createdAt: new Date().toISOString(),
    };
  }

  public verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
    return verifyStripeSignature(rawBody, signature, secret);
  }

  public parseWebhook(rawBody: string): GatewayWebhookEvent {
    const parsed = JSON.parse(rawBody);
    const data = parsed.data?.object || {};
    const metadata = data.metadata || {};

    return {
      eventType: parsed.type || "payment_intent.succeeded",
      invoiceId: metadata.invoiceId || data.client_reference_id || "",
      tenantId: metadata.tenantId || "",
      amountCents: Number(data.amount || data.amount_total || 0),
      currency: (data.currency || "usd").toUpperCase(),
      transactionReference: data.id || `pi_${randomUUID()}`,
      method: "card",
      status: data.status === "succeeded" || parsed.type === "checkout.session.completed" ? "succeeded" : "failed",
    };
  }
}

export class RazorpayAdapter implements PaymentGatewayAdapter {
  public async createSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const orderId = `order_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const checkoutUrl = `https://api.razorpay.com/v1/checkout/hosted?order_id=${orderId}`;

    return {
      id: orderId,
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      provider: "razorpay",
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      checkoutUrl,
      status: "pending",
      expiresAt,
      createdAt: new Date().toISOString(),
    };
  }

  public verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
    return verifyRazorpaySignature(rawBody, signature, secret);
  }

  public parseWebhook(rawBody: string): GatewayWebhookEvent {
    const parsed = JSON.parse(rawBody);
    const payload = parsed.payload?.payment?.entity || parsed.payload?.order?.entity || {};
    const notes = payload.notes || {};

    return {
      eventType: parsed.event || "payment.captured",
      invoiceId: notes.invoiceId || payload.receipt || "",
      tenantId: notes.tenantId || "",
      amountCents: Number(payload.amount || 0),
      currency: (payload.currency || "inr").toUpperCase(),
      transactionReference: payload.id || `pay_${randomUUID()}`,
      method: payload.method === "upi" ? "upi" : "card",
      status: payload.status === "captured" || parsed.event === "payment.captured" ? "succeeded" : "failed",
    };
  }
}

export class MockGatewayAdapter implements PaymentGatewayAdapter {
  public async createSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const id = `mock_sess_${randomUUID()}`;
    return {
      id,
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      provider: "mock",
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      checkoutUrl: `/api/finance/pay/mock/${id}`,
      status: "pending",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  public verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
    return signature === `mock_sig_${secret}`;
  }

  public parseWebhook(rawBody: string): GatewayWebhookEvent {
    const data = JSON.parse(rawBody);
    return {
      eventType: data.eventType || "payment.success",
      invoiceId: data.invoiceId,
      tenantId: data.tenantId,
      amountCents: Number(data.amountCents),
      currency: data.currency || "USD",
      transactionReference: data.transactionReference || `mock_tx_${randomUUID()}`,
      method: data.method || "card",
      status: "succeeded",
    };
  }
}
