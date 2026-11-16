import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentLinkTokenPayload } from "./types";

/**
 * Verifies Stripe Webhook Signature (`Stripe-Signature` header).
 * Format: `t=<timestamp>,v1=<signature>`
 * Employs constant-time comparison and 300-second timestamp tolerance to defend against replay attacks.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds: number = 300
): boolean {
  if (!rawBody || !signatureHeader || !webhookSecret) return false;

  const parts = signatureHeader.split(",");
  let timestampStr: string | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "t") timestampStr = value;
    if (key === "v1") signature = value;
  }

  if (!timestampStr || !signature) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false; // Expired / Replay
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHmac = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedHmac, "hex");

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Verifies Razorpay Webhook Signature (`X-Razorpay-Signature` header).
 * Direct HMAC-SHA256 hex digest of the raw request body.
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !signature || !webhookSecret) return false;

  const expectedHmac = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedHmac, "hex");

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Creates a signed client shareable payment link token (tamper-proof base64url HMAC token).
 */
export function generateSignedPaymentToken(
  payload: Omit<PaymentLinkTokenPayload, "expiresAt">,
  secretKey: string,
  expiresInHours: number = 72
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const fullPayload: PaymentLinkTokenPayload = { ...payload, expiresAt };

  const serialized = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = createHmac("sha256", secretKey).update(serialized).digest("base64url");

  return `${serialized}.${signature}`;
}

/**
 * Verifies and decodes a signed client payment link token.
 */
export function verifySignedPaymentToken(
  token: string,
  secretKey: string
): { isValid: boolean; payload?: PaymentLinkTokenPayload; reason?: string } {
  if (!token || !secretKey) {
    return { isValid: false, reason: "Token and secretKey are required" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { isValid: false, reason: "Malformed token format" };
  }

  const [serialized, signature] = parts;
  const expectedSignature = createHmac("sha256", secretKey).update(serialized).digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { isValid: false, reason: "Invalid signature / token tampered" };
  }

  try {
    const decodedJson = Buffer.from(serialized, "base64url").toString("utf-8");
    const payload = JSON.parse(decodedJson) as PaymentLinkTokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt && now > payload.expiresAt) {
      return { isValid: false, reason: "Payment link has expired" };
    }

    return { isValid: true, payload };
  } catch {
    return { isValid: false, reason: "Failed to deserialize token payload" };
  }
}
