import { createHash, createHmac } from "node:crypto";

/**
 * Deterministically serializes a JavaScript object into a canonical JSON string.
 * - Recursively sorts object keys lexicographically.
 * - Omits undefined values.
 * - Standardizes formatting across all platforms.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalJson(item)).join(",") + "]";
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();

  const pairs: string[] = [];
  for (const key of sortedKeys) {
    const value = record[key];
    if (value !== undefined) {
      pairs.push(`${JSON.stringify(key)}:${canonicalJson(value)}`);
    }
  }

  return "{" + pairs.join(",") + "}";
}

/**
 * Computes the SHA-256 hex digest of a UTF-8 string.
 */
export function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Computes the HMAC-SHA256 hex digest using a secret key.
 */
export function hmacSha256(data: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(data, "utf8").digest("hex");
}
