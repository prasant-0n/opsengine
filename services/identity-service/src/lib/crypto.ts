import * as crypto from "crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = Math.pow(2, 17); // N parameter for scrypt

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function comparePassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, derivedHex] = stored.split(":");
  if (!saltHex || !derivedHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const derived = Buffer.from(derivedHex, "hex");
  const computed = crypto.scryptSync(plain, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(derived, computed);
}

export function generateOtp(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
}
