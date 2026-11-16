import { isIP } from "node:net";

export interface SsrfValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Checks if an IPv4 address falls within a private, loopback, or link-local range.
 */
function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return true; // Malformed IP is unsafe
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (b0 === 10) return true;

  // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 – 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (b0 === 192 && b1 === 168) return true;

  // 169.254.0.0/16 (Link-local / AWS & Cloud Metadata: 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 100.64.0.0/10 (Carrier Grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  return false;
}

/**
 * Strict Anti-SSRF URL Validator.
 * Mandated by PRD §14.3 (Security and Privacy: SSRF Controls).
 */
export function validateWebhookUrl(rawUrl: string, allowHttpForTesting: boolean = true): SsrfValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isValid: false, reason: "Webhook destination URL is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { isValid: false, reason: "Invalid URL format" };
  }

  // 1. Enforce HTTP/HTTPS protocol
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { isValid: false, reason: `Unsupported protocol '${parsed.protocol}'. Only HTTP/HTTPS is allowed` };
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:" && !allowHttpForTesting) {
    return { isValid: false, reason: "HTTPS protocol is strictly required in production" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject Localhost & Common Internal Domains
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".corp") ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data"
  ) {
    return { isValid: false, reason: "Targeting localhost or internal network domains is strictly prohibited" };
  }

  // 3. Reject Direct Private/Loopback IP Addresses
  const ipType = isIP(hostname);
  if (ipType === 4) {
    if (isPrivateOrReservedIpv4(hostname)) {
      return { isValid: false, reason: `Destination IP '${hostname}' belongs to a private, loopback, or metadata subnet` };
    }
  } else if (ipType === 6) {
    // IPv6 Loopback or Unique Local / Link-local
    if (
      hostname === "::1" ||
      hostname.startsWith("fe80:") ||
      hostname.startsWith("fc00:") ||
      hostname.startsWith("fd00:")
    ) {
      return { isValid: false, reason: "Destination IPv6 address is in a private or loopback range" };
    }
  }

  return { isValid: true };
}
