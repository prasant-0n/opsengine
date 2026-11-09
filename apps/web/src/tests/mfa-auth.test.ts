import { describe, it, expect, beforeEach } from "vitest";
import {
  Base32,
  TotpEngine,
  MfaService,
} from "../lib/auth";
import { POST as postSetupRoute } from "../app/api/auth/mfa/setup/route";
import { POST as postConfirmRoute } from "../app/api/auth/mfa/confirm/route";
import { POST as postVerifyRoute } from "../app/api/auth/mfa/verify/route";
import { POST as postStepUpRoute } from "../app/api/auth/mfa/step-up/route";
import { NextRequest } from "next/server";

describe("Enterprise Multi-Factor Authentication (TOTP 2FA) & Session Step-Up (PRD Module 1 & §14.3)", () => {
  let mfaService: MfaService;

  beforeEach(() => {
    mfaService = new MfaService();
  });

  describe("1. Base32 & RFC 6238 TOTP Mathematics", () => {
    it("encodes and decodes buffers cleanly conforming to RFC 4648 Base32", () => {
      const original = Buffer.from("OpsEngineSecureSecret");
      const encoded = Base32.encode(original);

      expect(encoded).toMatch(/^[A-Z2-7]+$/);

      const decoded = Base32.decode(encoded);
      expect(decoded.toString("utf8")).toBe("OpsEngineSecureSecret");
    });

    it("generates a 160-bit (20 byte) random secret in Base32", () => {
      const secret = TotpEngine.generateSecret(20);
      expect(secret.length).toBe(32); // 20 bytes * 8 / 5 = 32 base32 chars
      expect(secret).toMatch(/^[A-Z2-7]+$/);
    });

    it("generates a standard 6-digit TOTP code and validates within clock drift window", () => {
      const secret = TotpEngine.generateSecret();
      const now = Date.now();

      const code = TotpEngine.generateTotp(secret, now);
      expect(code).toMatch(/^\d{6}$/);

      // Verify at exact timestamp
      const exactCheck = TotpEngine.verifyTotp(code, secret, { timeMs: now });
      expect(exactCheck.valid).toBe(true);

      // Verify clock drift tolerance: -25 seconds (within ±30s window)
      const pastCheck = TotpEngine.verifyTotp(code, secret, { timeMs: now - 25000 });
      expect(pastCheck.valid).toBe(true);

      // Verify clock drift tolerance: +25 seconds (within ±30s window)
      const futureCheck = TotpEngine.verifyTotp(code, secret, { timeMs: now + 25000 });
      expect(futureCheck.valid).toBe(true);

      // Rejects expired code: 3 minutes in the past
      const expiredCheck = TotpEngine.verifyTotp(code, secret, { timeMs: now - 180000 });
      expect(expiredCheck.valid).toBe(false);
    });

    it("generates a compliant otpauth:// URI for authenticator app enrollment", () => {
      const secret = "JBSWY3DPEHPK3PXP";
      const uri = TotpEngine.generateOtpauthUri("lead.architect@enterprise.io", secret, "OpsEngine");

      expect(uri).toContain("otpauth://totp/OpsEngine:lead.architect%40enterprise.io");
      expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
      expect(uri).toContain("issuer=OpsEngine");
      expect(uri).toContain("algorithm=SHA1");
      expect(uri).toContain("digits=6");
      expect(uri).toContain("period=30");
    });
  });

  describe("2. Emergency Backup Recovery Codes", () => {
    it("generates 10 single-use recovery codes with matching SHA-256 hashes", () => {
      const { plaintextCodes, hashedCodes } = TotpEngine.generateBackupCodes(10);

      expect(plaintextCodes.length).toBe(10);
      expect(hashedCodes.length).toBe(10);
      expect(plaintextCodes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);

      // Verifies valid backup code
      const check = TotpEngine.verifyBackupCode(plaintextCodes[0], hashedCodes);
      expect(check.valid).toBe(true);
      expect(check.matchedHashIndex).toBe(0);

      // Rejects invalid code
      const invalidCheck = TotpEngine.verifyBackupCode("INVALID-CODE", hashedCodes);
      expect(invalidCheck.valid).toBe(false);
    });
  });

  describe("3. Multi-Factor Enrollment & Verification Lifecycle", () => {
    it("initiates enrollment, activates with valid code, and prevents replay attacks", () => {
      // Step A: Setup
      const setup = mfaService.setup("usr_100", "tenant_alpha", "admin@alpha.com");
      expect(setup.secretBase32).toBeDefined();
      expect(setup.backupCodes.length).toBe(10);

      const statusBefore = mfaService.getStatus("usr_100", "tenant_alpha");
      expect(statusBefore.status).toBe("PENDING");
      expect(statusBefore.isEnabled).toBe(false);

      // Generate current TOTP code
      const code = TotpEngine.generateTotp(setup.secretBase32);

      // Step B: Confirm
      const confirmResult = mfaService.confirm("usr_100", "tenant_alpha", code);
      expect(confirmResult.success).toBe(true);

      const statusAfter = mfaService.getStatus("usr_100", "tenant_alpha");
      expect(statusAfter.status).toBe("ACTIVE");
      expect(statusAfter.isEnabled).toBe(true);

      // Step C: Replay Protection Check
      // Attempting to re-verify the exact same code within the same 30s window must fail!
      const replayAttempt = mfaService.verify("usr_100", "tenant_alpha", code);
      expect(replayAttempt.valid).toBe(false);
      expect(replayAttempt.error).toContain("replay prevented");
    });

    it("burns emergency recovery code upon redemption (single-use enforcement)", () => {
      const setup = mfaService.setup("usr_200", "tenant_alpha", "sec@alpha.com");
      const code = TotpEngine.generateTotp(setup.secretBase32);
      mfaService.confirm("usr_200", "tenant_alpha", code);

      const backupCode = setup.backupCodes[0];

      // First use of backup code -> Valid!
      const firstUse = mfaService.verify("usr_200", "tenant_alpha", backupCode);
      expect(firstUse.valid).toBe(true);
      expect(firstUse.method).toBe("BACKUP_CODE");

      const status = mfaService.getStatus("usr_200", "tenant_alpha");
      expect(status.remainingBackupCodes).toBe(9); // Decremented!

      // Second use of same backup code -> Rejected!
      const secondUse = mfaService.verify("usr_200", "tenant_alpha", backupCode);
      expect(secondUse.valid).toBe(false);
    });
  });

  describe("4. Session Step-Up Token Lifecycle", () => {
    it("issues a time-bound step-up token and validates scope boundaries", () => {
      const setup = mfaService.setup("usr_300", "tenant_alpha", "lead@alpha.com");
      const confirmCode = TotpEngine.generateTotp(setup.secretBase32);
      mfaService.confirm("usr_300", "tenant_alpha", confirmCode);

      // Advance clock slightly (31s) so step advances and code is fresh
      const stepUpTime = Date.now() + 31000;
      const stepUpCode = TotpEngine.generateTotp(setup.secretBase32, stepUpTime);

      const stepUp = mfaService.issueStepUp("usr_300", "tenant_alpha", stepUpCode, "TENANT_ADMIN");
      expect(stepUp.success).toBe(true);
      expect(stepUp.stepUpToken).toBeDefined();

      // Validate matching scope
      const validation = mfaService.validateStepUp(
        stepUp.stepUpToken!,
        "TENANT_ADMIN",
        "tenant_alpha",
        "usr_300"
      );
      expect(validation.valid).toBe(true);

      // Scope mismatch rejection
      const mismatch = mfaService.validateStepUp(
        stepUp.stepUpToken!,
        "DATA_EXPORT",
        "tenant_alpha",
        "usr_300"
      );
      expect(mismatch.valid).toBe(false);
      expect(mismatch.error).toContain("scope mismatch");
    });
  });

  describe("5. Strict Cross-Tenant Negative Isolation (PRD Binding Rule)", () => {
    it("cross-tenant negative gate: prevents Tenant B user from elevating session in Tenant A", () => {
      // User in Tenant Alpha
      const alphaSetup = mfaService.setup("usr_alpha", "tenant_alpha", "alice@alpha.com");
      const alphaCode = TotpEngine.generateTotp(alphaSetup.secretBase32);
      mfaService.confirm("usr_alpha", "tenant_alpha", alphaCode);

      // User in Tenant Bravo
      const bravoSetup = mfaService.setup("usr_bravo", "tenant_bravo", "bob@bravo.com");
      const bravoCode = TotpEngine.generateTotp(bravoSetup.secretBase32);
      mfaService.confirm("usr_bravo", "tenant_bravo", bravoCode);

      // Fresh code for Bravo
      const freshTime = Date.now() + 31000;
      const freshBravoCode = TotpEngine.generateTotp(bravoSetup.secretBase32, freshTime);

      // Bob from Tenant Bravo attempts to verify using his code against Tenant Alpha
      const crossTenantAttempt = mfaService.verify("usr_alpha", "tenant_alpha", freshBravoCode);
      expect(crossTenantAttempt.valid).toBe(false);
    });
  });

  describe("6. REST API Route Integration", () => {
    it("handles setup, confirm, verify, and step-up API endpoints", async () => {
      // 1. Setup API
      const setupReq = new NextRequest("http://localhost:3000/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": "tenant_api_test" },
        body: JSON.stringify({ userId: "usr_api_1", email: "api.user@test.com" }),
      });

      const setupRes = await postSetupRoute(setupReq);
      expect(setupRes.status).toBe(200);
      const setupData = await setupRes.json();
      expect(setupData.secretBase32).toBeDefined();

      // 2. Confirm API
      const code = TotpEngine.generateTotp(setupData.secretBase32);
      const confirmReq = new NextRequest("http://localhost:3000/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": "tenant_api_test" },
        body: JSON.stringify({ userId: "usr_api_1", code }),
      });

      const confirmRes = await postConfirmRoute(confirmReq);
      expect(confirmRes.status).toBe(200);
      const confirmData = await confirmRes.json();
      expect(confirmData.status).toBe("ACTIVE");

      // 3. Step-Up API (advance by 31s for fresh code)
      const freshCode = TotpEngine.generateTotp(setupData.secretBase32, Date.now() + 31000);
      const stepUpReq = new NextRequest("http://localhost:3000/api/auth/mfa/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": "tenant_api_test" },
        body: JSON.stringify({
          userId: "usr_api_1",
          code: freshCode,
          scope: "BREAK_GLASS",
        }),
      });

      const stepUpRes = await postStepUpRoute(stepUpReq);
      expect(stepUpRes.status).toBe(200);
      const stepUpData = await stepUpRes.json();
      expect(stepUpData.stepUpToken).toBeDefined();
      expect(stepUpData.scope).toBe("BREAK_GLASS");
    });
  });
});
