import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  globalPaymentGatewayService,
  verifyStripeSignature,
  verifyRazorpaySignature,
  generateSignedPaymentToken,
  verifySignedPaymentToken,
} from "../lib/payment-gateway";

describe("Module 12 — Payment Gateway Integration (Stripe & Razorpay Checkout, Webhooks & Automated Reconciliation)", () => {
  const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
  const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
  const INVOICE_A = "00000000-0000-4000-8000-000000000101";

  beforeEach(() => {
    globalPaymentGatewayService.reset();
  });

  describe("1. Gateway Cryptographic Webhook Signatures", () => {
    const stripeSecret = "whsec_test_stripe_secret_123456789";
    const razorpaySecret = "whsec_test_razorpay_secret_987654321";

    it("verifies authentic Stripe signature header (t=...,v1=...)", () => {
      const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
      const now = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", stripeSecret)
        .update(`${now}.${payload}`)
        .digest("hex");
      const header = `t=${now},v1=${signature}`;

      const isValid = verifyStripeSignature(payload, header, stripeSecret);
      expect(isValid).toBe(true);
    });

    it("rejects tampered Stripe payload", () => {
      const originalPayload = JSON.stringify({ amount: 10000 });
      const tamperedPayload = JSON.stringify({ amount: 99999 });
      const now = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", stripeSecret)
        .update(`${now}.${originalPayload}`)
        .digest("hex");
      const header = `t=${now},v1=${signature}`;

      const isValid = verifyStripeSignature(tamperedPayload, header, stripeSecret);
      expect(isValid).toBe(false);
    });

    it("rejects expired Stripe signature beyond 300s tolerance (replay attack defense)", () => {
      const payload = JSON.stringify({ id: "evt_replay" });
      const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const signature = createHmac("sha256", stripeSecret)
        .update(`${staleTimestamp}.${payload}`)
        .digest("hex");
      const header = `t=${staleTimestamp},v1=${signature}`;

      const isValid = verifyStripeSignature(payload, header, stripeSecret, 300);
      expect(isValid).toBe(false);
    });

    it("verifies authentic Razorpay webhook signature", () => {
      const payload = JSON.stringify({ event: "payment.captured", entity: { id: "pay_123" } });
      const signature = createHmac("sha256", razorpaySecret).update(payload).digest("hex");

      const isValid = verifyRazorpaySignature(payload, signature, razorpaySecret);
      expect(isValid).toBe(true);
    });

    it("rejects forged Razorpay webhook signature", () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const isValid = verifyRazorpaySignature(payload, "forged_hex_signature", razorpaySecret);
      expect(isValid).toBe(false);
    });
  });

  describe("2. Client Shareable Signed Payment Links", () => {
    const tokenSecret = "test-secret-key-for-shareable-payment-links-32ch";

    it("generates a signed payment token and verifies its payload", () => {
      const token = generateSignedPaymentToken(
        {
          invoiceId: INVOICE_A,
          tenantId: TENANT_A,
          amountCents: 150000,
          currency: "USD",
        },
        tokenSecret,
        72
      );

      expect(token).toContain(".");

      const verification = verifySignedPaymentToken(token, tokenSecret);
      expect(verification.isValid).toBe(true);
      expect(verification.payload?.invoiceId).toBe(INVOICE_A);
      expect(verification.payload?.tenantId).toBe(TENANT_A);
      expect(verification.payload?.amountCents).toBe(150000);
      expect(verification.payload?.currency).toBe("USD");
      expect(verification.payload?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("rejects tampered token content", () => {
      const token = generateSignedPaymentToken(
        { invoiceId: INVOICE_A, tenantId: TENANT_A, amountCents: 5000, currency: "USD" },
        tokenSecret
      );

      const [, sig] = token.split(".");
      // Tamper base64 payload to request $1000 instead of $50
      const tamperedPayload = Buffer.from(
        JSON.stringify({ invoiceId: INVOICE_A, tenantId: TENANT_A, amountCents: 100000, currency: "USD" })
      ).toString("base64url");

      const tamperedToken = `${tamperedPayload}.${sig}`;
      const verification = verifySignedPaymentToken(tamperedToken, tokenSecret);

      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain("Invalid signature");
    });

    it("rejects expired payment link tokens", () => {
      // Create a token expired 1 hour ago
      const expiredPayload = {
        invoiceId: INVOICE_A,
        tenantId: TENANT_A,
        amountCents: 5000,
        currency: "USD",
        expiresAt: Math.floor(Date.now() / 1000) - 3600,
      };

      const serialized = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
      const signature = createHmac("sha256", tokenSecret).update(serialized).digest("base64url");
      const expiredToken = `${serialized}.${signature}`;

      const verification = verifySignedPaymentToken(expiredToken, tokenSecret);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain("expired");
    });
  });

  describe("3. Multi-Gateway Checkout Session Creation", () => {
    it("creates a Stripe checkout session with integer cents", async () => {
      const session = await globalPaymentGatewayService.createCheckoutSession({
        tenantId: TENANT_A,
        invoiceId: INVOICE_A,
        amountCents: 125000, // $1,250.00
        currency: "USD",
        provider: "stripe",
      });

      expect(session.id).toMatch(/^cs_test_/);
      expect(session.provider).toBe("stripe");
      expect(session.amountCents).toBe(125000);
      expect(session.currency).toBe("USD");
      expect(session.checkoutUrl).toContain(session.id);
      expect(session.status).toBe("pending");
      expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("creates a Razorpay order session with integer paise/cents", async () => {
      const session = await globalPaymentGatewayService.createCheckoutSession({
        tenantId: TENANT_A,
        invoiceId: INVOICE_A,
        amountCents: 5000000, // INR 50,000.00
        currency: "INR",
        provider: "razorpay",
      });

      expect(session.id).toMatch(/^order_/);
      expect(session.provider).toBe("razorpay");
      expect(session.amountCents).toBe(5000000);
      expect(session.currency).toBe("INR");
      expect(session.checkoutUrl).toContain(session.id);
      expect(session.status).toBe("pending");
    });

    it("rejects non-positive amount cents (PRD §12.2 integer cents rule)", async () => {
      await expect(
        globalPaymentGatewayService.createCheckoutSession({
          tenantId: TENANT_A,
          invoiceId: INVOICE_A,
          amountCents: -500,
          currency: "USD",
          provider: "stripe",
        })
      ).rejects.toThrow("positive integer");
    });
  });

  describe("4. Inbound Webhook Processing & Exactly-Once Idempotency", () => {
    const stripeSecret = "whsec_test_stripe_secret";
    const razorpaySecret = "whsec_test_razorpay_secret";

    it("processes Stripe webhook and marks payment succeeded", async () => {
      const rawBody = JSON.stringify({
        id: "evt_stripe_test_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "pi_stripe_123456",
            amount: 75000,
            currency: "usd",
            status: "succeeded",
            metadata: {
              tenantId: TENANT_A,
              invoiceId: INVOICE_A,
            },
          },
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const sig = createHmac("sha256", stripeSecret).update(`${now}.${rawBody}`).digest("hex");
      const signatureHeader = `t=${now},v1=${sig}`;

      const res = await globalPaymentGatewayService.processWebhook(
        "stripe",
        rawBody,
        signatureHeader,
        stripeSecret
      );

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(false);
      expect(res.payment.transactionReference).toBe("pi_stripe_123456");
      expect(res.payment.amountCents).toBe(75000);
      expect(res.payment.provider).toBe("stripe");
      expect(res.payment.method).toBe("card");
    });

    it("enforces exactly-once idempotency: duplicate webhook replays are recognized and skipped", async () => {
      const rawBody = JSON.stringify({
        id: "evt_stripe_dup",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_stripe_dup_unique_99",
            amount: 50000,
            currency: "usd",
            status: "succeeded",
            metadata: {
              tenantId: TENANT_A,
              invoiceId: INVOICE_A,
            },
          },
        },
      });

      const now = Math.floor(Date.now() / 1000);
      const sig = createHmac("sha256", stripeSecret).update(`${now}.${rawBody}`).digest("hex");
      const signatureHeader = `t=${now},v1=${sig}`;

      // First dispatch
      const res1 = await globalPaymentGatewayService.processWebhook(
        "stripe",
        rawBody,
        signatureHeader,
        stripeSecret
      );
      expect(res1.duplicate).toBe(false);

      // Replayed dispatch
      const res2 = await globalPaymentGatewayService.processWebhook(
        "stripe",
        rawBody,
        signatureHeader,
        stripeSecret
      );
      expect(res2.duplicate).toBe(true);
      expect(res2.payment.transactionReference).toBe("pi_stripe_dup_unique_99");
    });

    it("processes Razorpay webhook and records UPI/card method", async () => {
      const rawBody = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_987654",
              amount: 2500000,
              currency: "INR",
              method: "upi",
              status: "captured",
              notes: {
                tenantId: TENANT_A,
                invoiceId: INVOICE_A,
              },
            },
          },
        },
      });

      const sig = createHmac("sha256", razorpaySecret).update(rawBody).digest("hex");

      const res = await globalPaymentGatewayService.processWebhook(
        "razorpay",
        rawBody,
        sig,
        razorpaySecret
      );

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(false);
      expect(res.payment.transactionReference).toBe("pay_rzp_987654");
      expect(res.payment.amountCents).toBe(2500000);
      expect(res.payment.method).toBe("upi");
      expect(res.payment.provider).toBe("razorpay");
    });
  });

  describe("5. Multi-Tenant Negative Isolation", () => {
    it("ensures Tenant B cannot view Tenant A processed gateway payments", async () => {
      const rawBody = JSON.stringify({
        id: "evt_isolation_test",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "pi_isolation_1",
            amount: 10000,
            currency: "usd",
            status: "succeeded",
            metadata: {
              tenantId: TENANT_A,
              invoiceId: INVOICE_A,
            },
          },
        },
      });

      const secret = "whsec_test_stripe_secret";
      const now = Math.floor(Date.now() / 1000);
      const sig = createHmac("sha256", secret).update(`${now}.${rawBody}`).digest("hex");

      await globalPaymentGatewayService.processWebhook("stripe", rawBody, `t=${now},v1=${sig}`, secret);

      // Tenant A has 1 payment
      expect(globalPaymentGatewayService.getProcessedPayments(TENANT_A)).toHaveLength(1);

      // Tenant B queries payments -> must be 0 (zero cross-tenant leakage)
      expect(globalPaymentGatewayService.getProcessedPayments(TENANT_B)).toHaveLength(0);
    });
  });
});
