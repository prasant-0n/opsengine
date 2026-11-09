/**
 * Multi-Factor Authentication (MFA) & Session Step-Up Service
 * PRD Module 1 (Identity & Authentication) & PRD §14.3
 */

import { TotpEngine } from "./totp";
import { randomUUID } from "node:crypto";

export type StepUpScope =
  | "TENANT_ADMIN"
  | "DATA_EXPORT"
  | "BREAK_GLASS"
  | "FINANCE_MUTATION";

export interface TotpEnrollment {
  userId: string;
  tenantId: string;
  email: string;
  secretBase32: string;
  otpauthUri: string;
  status: "PENDING" | "ACTIVE" | "DISABLED";
  backupCodesHashed: string[];
  enrolledAt?: string;
  lastUsedStep?: number;
}

export interface StepUpToken {
  token: string;
  userId: string;
  tenantId: string;
  scope: StepUpScope;
  issuedAt: string;
  expiresAt: string;
}

export class MfaService {
  private enrollments = new Map<string, TotpEnrollment>();
  private stepUpTokens = new Map<string, StepUpToken>();

  private getKey(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }

  /**
   * Initiates TOTP 2FA enrollment for a user
   */
  public setup(
    userId: string,
    tenantId: string,
    email: string
  ): { secretBase32: string; otpauthUri: string; backupCodes: string[] } {
    if (!userId || !tenantId || !email) {
      throw new Error("userId, tenantId, and email are mandatory to setup MFA");
    }

    const key = this.getKey(tenantId, userId);
    const secretBase32 = TotpEngine.generateSecret(20);
    const otpauthUri = TotpEngine.generateOtpauthUri(email, secretBase32);
    const { plaintextCodes, hashedCodes } = TotpEngine.generateBackupCodes(10);

    const enrollment: TotpEnrollment = {
      userId,
      tenantId,
      email,
      secretBase32,
      otpauthUri,
      status: "PENDING",
      backupCodesHashed: hashedCodes,
    };

    this.enrollments.set(key, enrollment);

    return {
      secretBase32,
      otpauthUri,
      backupCodes: plaintextCodes,
    };
  }

  /**
   * Confirms and activates TOTP 2FA with the first code from authenticator app
   */
  public confirm(
    userId: string,
    tenantId: string,
    code: string
  ): { success: boolean; error?: string } {
    const key = this.getKey(tenantId, userId);
    const enrollment = this.enrollments.get(key);

    if (!enrollment || enrollment.status !== "PENDING") {
      return { success: false, error: "No pending MFA enrollment found for this account" };
    }

    const verification = TotpEngine.verifyTotp(code, enrollment.secretBase32);
    if (!verification.valid) {
      return { success: false, error: "Invalid authenticator code. Check app clock time." };
    }

    enrollment.status = "ACTIVE";
    enrollment.enrolledAt = new Date().toISOString();
    enrollment.lastUsedStep = verification.matchedStep;

    return { success: true };
  }

  /**
   * Verifies an MFA challenge using either 6-digit TOTP or backup recovery code
   */
  public verify(
    userId: string,
    tenantId: string,
    code: string
  ): { valid: boolean; method?: "TOTP" | "BACKUP_CODE"; error?: string } {
    const key = this.getKey(tenantId, userId);
    const enrollment = this.enrollments.get(key);

    if (!enrollment || enrollment.status !== "ACTIVE") {
      return { valid: false, error: "MFA is not active on this account" };
    }

    const cleanCode = code.trim();

    // 1. Check 6-digit TOTP Code
    if (/^\d{6}$/.test(cleanCode)) {
      const verification = TotpEngine.verifyTotp(cleanCode, enrollment.secretBase32);
      if (!verification.valid) {
        return { valid: false, error: "Invalid TOTP code" };
      }

      // Replay prevention: do not allow same time-step reuse
      if (enrollment.lastUsedStep && verification.matchedStep! <= enrollment.lastUsedStep) {
        return {
          valid: false,
          error: "TOTP code has already been used in current time window (replay prevented)",
        };
      }

      enrollment.lastUsedStep = verification.matchedStep;
      return { valid: true, method: "TOTP" };
    }

    // 2. Check Emergency Backup Recovery Code (single-use)
    const backupCheck = TotpEngine.verifyBackupCode(cleanCode, enrollment.backupCodesHashed);
    if (backupCheck.valid && backupCheck.matchedHashIndex !== undefined) {
      // Invalidate the used backup code permanently
      enrollment.backupCodesHashed.splice(backupCheck.matchedHashIndex, 1);
      return { valid: true, method: "BACKUP_CODE" };
    }

    return { valid: false, error: "Invalid verification code or recovery code" };
  }

  /**
   * Issues a time-bound step-up token upon successful MFA verification
   */
  public issueStepUp(
    userId: string,
    tenantId: string,
    code: string,
    scope: StepUpScope = "TENANT_ADMIN",
    validityMinutes: number = 15
  ): { success: boolean; stepUpToken?: string; expiresAt?: string; error?: string } {
    const verification = this.verify(userId, tenantId, code);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityMinutes * 60000).toISOString();

    const record: StepUpToken = {
      token,
      userId,
      tenantId,
      scope,
      issuedAt: now.toISOString(),
      expiresAt,
    };

    this.stepUpTokens.set(token, record);

    return {
      success: true,
      stepUpToken: token,
      expiresAt,
    };
  }

  /**
   * Validates a step-up token for a privileged operation
   */
  public validateStepUp(
    token: string,
    expectedScope: StepUpScope,
    expectedTenantId?: string,
    expectedUserId?: string
  ): { valid: boolean; error?: string } {
    if (!token) return { valid: false, error: "Missing step-up token" };

    const record = this.stepUpTokens.get(token);
    if (!record) return { valid: false, error: "Step-up token not found or revoked" };

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      this.stepUpTokens.delete(token);
      return { valid: false, error: "Step-up token has expired" };
    }

    if (record.scope !== expectedScope) {
      return { valid: false, error: `Step-up scope mismatch: requires ${expectedScope}` };
    }

    if (expectedTenantId && record.tenantId !== expectedTenantId) {
      return { valid: false, error: "Cross-tenant step-up token violation" };
    }

    if (expectedUserId && record.userId !== expectedUserId) {
      return { valid: false, error: "Step-up token belongs to a different user" };
    }

    return { valid: true };
  }

  /**
   * Retrieves current MFA status for account
   */
  public getStatus(
    userId: string,
    tenantId: string
  ): { isEnabled: boolean; status: "NONE" | "PENDING" | "ACTIVE" | "DISABLED"; remainingBackupCodes: number } {
    const key = this.getKey(tenantId, userId);
    const enrollment = this.enrollments.get(key);

    if (!enrollment) {
      return { isEnabled: false, status: "NONE", remainingBackupCodes: 0 };
    }

    return {
      isEnabled: enrollment.status === "ACTIVE",
      status: enrollment.status,
      remainingBackupCodes: enrollment.backupCodesHashed.length,
    };
  }

  /**
   * Disables MFA on an account
   */
  public disable(userId: string, tenantId: string): boolean {
    const key = this.getKey(tenantId, userId);
    const enrollment = this.enrollments.get(key);
    if (!enrollment) return false;

    enrollment.status = "DISABLED";
    return true;
  }

  /**
   * Reset store for testing
   */
  public reset(): void {
    this.enrollments.clear();
    this.stepUpTokens.clear();
  }
}

const globalForMfa = globalThis as unknown as {
  __OPSENGINE_MFA_SERVICE__?: MfaService;
};

export const globalMfaService =
  globalForMfa.__OPSENGINE_MFA_SERVICE__ ?? new MfaService();

if (process.env.NODE_ENV !== "production") {
  globalForMfa.__OPSENGINE_MFA_SERVICE__ = globalMfaService;
}
