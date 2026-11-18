import crypto from "node:crypto";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  url?: string;
  actions?: Array<{ action: string; title: string }>;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

// Allowed push gateway host suffixes to prevent SSRF
const ALLOWED_PUSH_HOST_SUFFIXES = [
  "googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
  "wns.windows.com",
];

// RFC 1918 and loopback indicators to block
const DISALLOWED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "::1",
  "169.254.169.254",
  "0.0.0.0",
];

/**
 * Validates push endpoint URL to prevent Server-Side Request Forgery (SSRF)
 */
export function validatePushEndpoint(endpoint: string): { valid: boolean; reason?: string } {
  if (!endpoint || typeof endpoint !== "string") {
    return { valid: false, reason: "Endpoint URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch (_e) {
    return { valid: false, reason: "Malformed endpoint URL." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Push endpoint must use HTTPS protocol." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block loopback and local networks
  if (
    DISALLOWED_HOSTNAMES.includes(hostname) ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    (hostname.startsWith("172.") &&
      (() => {
        const secondOctet = parseInt(hostname.split(".")[1] || "0", 10);
        return secondOctet >= 16 && secondOctet <= 31;
      })()) ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    return { valid: false, reason: "Internal or private network endpoints are forbidden." };
  }

  // Verify hostname belongs to recognized Web Push providers
  const isAllowedHost = ALLOWED_PUSH_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );

  if (!isAllowedHost) {
    return {
      valid: false,
      reason: `Push provider host "${hostname}" is not in the recognized Web Push allowlist.`,
    };
  }

  return { valid: true };
}

/**
 * Generates an ECDSA P-256 key pair suitable for Web Push VAPID authentication
 */
export function generateVapidKeyPair(): VapidKeys {
  const ec = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: {
      type: "spki",
      format: "der",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  // Extract raw uncompressed 65-byte public key (0x04 + 32-byte X + 32-byte Y) from SPKI DER
  // In SPKI DER for prime256v1, the raw 65-byte EC point begins at offset 26
  const spkiDer = ec.publicKey as Buffer;
  const rawPublicKey = spkiDer.subarray(spkiDer.length - 65);
  const base64UrlPublicKey = rawPublicKey.toString("base64url");

  return {
    publicKey: base64UrlPublicKey,
    privateKey: ec.privateKey as string,
  };
}

// Fallback in-memory VAPID keypair for test & development environments
let cachedVapidKeys: VapidKeys | null = null;

export function getVapidKeys(): VapidKeys {
  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    return {
      publicKey: envPublic,
      privateKey: envPrivate,
    };
  }

  if (!cachedVapidKeys) {
    cachedVapidKeys = generateVapidKeyPair();
  }

  return cachedVapidKeys;
}

/**
 * Builds standard VAPID Authorization header (RFC 8292)
 */
export function createVapidAuthorizationHeader(
  endpoint: string,
  subject: string = process.env.VAPID_SUBJECT || "mailto:security@opsengine.com"
): { header: string; token: string } {
  const keys = getVapidKeys();
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const header = {
    typ: "JWT",
    alg: "ES256",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: subject,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("SHA256");
  signer.update(signInput);
  signer.end();

  const signature = signer.sign(
    {
      key: keys.privateKey,
      dsaEncoding: "ieee-p1363", // IEEE P1363 (r || s 64-byte raw) for ES256
    },
    "base64url"
  );

  const token = `${signInput}.${signature}`;
  return {
    header: `vapid t=${token}, k=${keys.publicKey}`,
    token,
  };
}

/**
 * Dispatches push notification to a registered device endpoint
 */
export async function sendWebPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const validation = validatePushEndpoint(subscription.endpoint);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  try {
    const { header } = createVapidAuthorizationHeader(subscription.endpoint);
    const bodyString = JSON.stringify(payload);

    // In local unit tests or offline CI, mock dispatch when MOCK_PUSH_DISPATCH is true
    if (process.env.MOCK_PUSH_DISPATCH === "true" || process.env.NODE_ENV === "test") {
      return {
        success: true,
        statusCode: 201,
      };
    }

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: header,
        "Content-Type": "application/json",
        TTL: "86400",
        Urgency: "normal",
      },
      body: bodyString,
    });

    if (response.ok || response.status === 201) {
      return { success: true, statusCode: response.status };
    }

    // 404 or 410 indicates endpoint expired/unsubscribed
    return {
      success: false,
      statusCode: response.status,
      error: `Push gateway returned status ${response.status}: ${response.statusText}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to dispatch push notification";
    return {
      success: false,
      error: message,
    };
  }
}
