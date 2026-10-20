import * as crypto from "crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = 2 ** 17;
const SCRYPT_PARAMS = {
  N: SCRYPT_COST,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
} as const;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = await deriveKey(password, salt);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function comparePassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, derivedHex] = stored.split(":");
  if (!saltHex || !derivedHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const derived = Buffer.from(derivedHex, "hex");
  const computed = await deriveKey(plain, salt);
  if (computed.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, computed);
}

export function generateOtp(): string {
  return Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join("");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
