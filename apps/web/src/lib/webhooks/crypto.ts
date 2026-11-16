import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generates a high-entropy secret key for webhook HMAC signing.
 * Prefixed with `whsec_` for clear credential identification.
 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/**
 * Computes an HMAC-SHA256 signature for the given payload and timestamp.
 * Output format: `t=<timestamp>,v1=<hex_signature>`
 */
export function signWebhookPayload(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): { signatureHeader: string; timestamp: number; signature: string } {
  const signedData = `${timestamp}.${payload}`;
  const hmac = createHmac("sha256", secret).update(signedData).digest("hex");
  const signatureHeader = `t=${timestamp},v1=${hmac}`;

  return { signatureHeader, timestamp, signature: hmac };
}

/**
 * Verifies that a webhook signature header matches the expected payload and secret.
 * Defends against replay attacks with configurable clock drift tolerance (default 5 minutes).
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  // Parse header: t=1612345678,v1=abcdef...
  const parts = signatureHeader.split(",");
  let timestampStr: string | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "t") timestampStr = value;
    if (key === "v1") signature = value;
  }

  if (!timestampStr || !signature) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return false;
  }

  // Replay Attack Defense: Check clock skew / age
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestamp) > toleranceSeconds) {
    return false;
  }

  // Compute expected signature
  const signedData = `${timestamp}.${payload}`;
  const expectedHmac = createHmac("sha256", secret).update(signedData).digest("hex");

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedHmac, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(sigBuffer, expectedBuffer);
}
