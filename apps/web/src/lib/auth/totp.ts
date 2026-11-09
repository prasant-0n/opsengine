/**
 * RFC 6238 Time-Based One-Time Password (TOTP) & RFC 4648 Base32 Engine
 * Zero external dependencies; built using native node:crypto
 * PRD Module 1 (Identity & Authentication) & PRD §14.3
 */

import { createHmac, randomBytes, createHash } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export class Base32 {
  /**
   * Encodes a Buffer or Uint8Array into an RFC 4648 Base32 string (no padding)
   */
  public static encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = "";

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Decodes an RFC 4648 Base32 string into a Buffer
   */
  public static decode(input: string): Buffer {
    const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/[\s-]/g, "");
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
      if (idx === -1) {
        throw new Error(`Invalid Base32 character: '${cleaned[i]}'`);
      }

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}

export interface VerifyTotpOptions {
  timeMs?: number;
  stepSeconds?: number;
  digits?: number;
  window?: number; // Allowed clock drift in steps (default: 1, i.e. -30s to +30s)
}

export class TotpEngine {
  /**
   * Generates a cryptographically secure 160-bit (20 byte) random secret in Base32
   */
  public static generateSecret(byteLength: number = 20): string {
    const buffer = randomBytes(byteLength);
    return Base32.encode(buffer);
  }

  /**
   * Generates an RFC 6238 TOTP code for a secret and time
   */
  public static generateTotp(
    secretBase32: string,
    timeMs: number = Date.now(),
    stepSeconds: number = 30,
    digits: number = 6
  ): string {
    const key = Base32.decode(secretBase32);
    const counter = Math.floor(timeMs / 1000 / stepSeconds);

    // 8-byte big-endian counter buffer
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    // HMAC-SHA1
    const hmac = createHmac("sha1", key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    // Dynamic truncation (RFC 4226 Section 5.4)
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const token = binary % Math.pow(10, digits);
    return token.toString().padStart(digits, "0");
  }

  /**
   * Validates a TOTP code against clock drift windows [-window, +window]
   */
  public static verifyTotp(
    code: string,
    secretBase32: string,
    options?: VerifyTotpOptions
  ): { valid: boolean; matchedStep?: number } {
    if (!code || code.length !== (options?.digits || 6)) {
      return { valid: false };
    }

    const timeMs = options?.timeMs ?? Date.now();
    const stepSeconds = options?.stepSeconds ?? 30;
    const digits = options?.digits ?? 6;
    const window = options?.window ?? 1; // Default ±1 step (±30s)

    const currentCounter = Math.floor(timeMs / 1000 / stepSeconds);

    for (let stepOffset = -window; stepOffset <= window; stepOffset++) {
      const stepTimeMs = (currentCounter + stepOffset) * stepSeconds * 1000;
      const expectedCode = TotpEngine.generateTotp(secretBase32, stepTimeMs, stepSeconds, digits);

      if (code === expectedCode) {
        return { valid: true, matchedStep: currentCounter + stepOffset };
      }
    }

    return { valid: false };
  }

  /**
   * Generates standard otpauth:// URI for QR code generation
   */
  public static generateOtpauthUri(
    email: string,
    secretBase32: string,
    issuer: string = "OpsEngine"
  ): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generates single-use emergency backup recovery codes
   */
  public static generateBackupCodes(
    count: number = 10
  ): { plaintextCodes: string[]; hashedCodes: string[] } {
    const plaintextCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Format: XXXX-XXXX (8 uppercase alphanumeric)
      const part1 = randomBytes(2).toString("hex").toUpperCase();
      const part2 = randomBytes(2).toString("hex").toUpperCase();
      const code = `${part1}-${part2}`;

      plaintextCodes.push(code);
      const hash = createHash("sha256").update(code).digest("hex");
      hashedCodes.push(hash);
    }

    return { plaintextCodes, hashedCodes };
  }

  /**
   * Verifies a plain backup code against an array of SHA-256 hashes
   */
  public static verifyBackupCode(
    plainCode: string,
    hashedCodes: string[]
  ): { valid: boolean; matchedHashIndex?: number } {
    const cleanCode = plainCode.trim().toUpperCase();
    const hash = createHash("sha256").update(cleanCode).digest("hex");

    const idx = hashedCodes.indexOf(hash);
    if (idx !== -1) {
      return { valid: true, matchedHashIndex: idx };
    }
    return { valid: false };
  }
}
