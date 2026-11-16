import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/prisma";
import {
  createGoogleOAuthState,
  verifyGoogleOAuthState,
  sanitizeReturnTo,
  getGoogleAuthUrl,
  completeGoogleSSOFlow,
  type GoogleProfile,
} from "../features/auth/lib/google-sso";
import { buildAuthContext } from "../lib/permissions";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

describe("Module 1 — Google OAuth 2.0 / SSO Integration", () => {
  describe("State Token Cryptographic Verification & CSRF Protection", () => {
    it("generates and verifies a valid HMAC-SHA256 signed state token", () => {
      const state = createGoogleOAuthState({
        domain: "acme.opsengine.enterprise",
        tenantId: TENANT_A,
        returnTo: "/dashboard/reports",
      });

      expect(typeof state).toBe("string");
      expect(state.includes(".")).toBe(true);

      const verified = verifyGoogleOAuthState(state);
      expect(verified).not.toBeNull();
      expect(verified?.domain).toBe("acme.opsengine.enterprise");
      expect(verified?.tenantId).toBe(TENANT_A);
      expect(verified?.returnTo).toBe("/dashboard/reports");
      expect(verified?.csrf).toBeDefined();
      expect(typeof verified?.exp).toBe("number");
      expect(verified!.exp).toBeGreaterThan(Date.now());
    });

    it("rejects state tokens with tampered payload or forged signature", () => {
      const state = createGoogleOAuthState({ domain: "acme.opsengine.enterprise" });
      const [payloadB64, signature] = state.split(".");

      // Tampered signature
      const badSig = signature.slice(0, -2) + "xx";
      expect(verifyGoogleOAuthState(`${payloadB64}.${badSig}`)).toBeNull();

      // Tampered payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ domain: "evil.opsengine.enterprise", exp: Date.now() + 60000 })
      ).toString("base64url");
      expect(verifyGoogleOAuthState(`${tamperedPayload}.${signature}`)).toBeNull();

      // Completely malformed tokens
      expect(verifyGoogleOAuthState("not-a-valid-token")).toBeNull();
      expect(verifyGoogleOAuthState("")).toBeNull();
      expect(verifyGoogleOAuthState("a.b.c")).toBeNull();
    });

    it("rejects expired state tokens", () => {
      // Construct expired state payload
      const expiredPayload = {
        csrf: "test-csrf-token",
        domain: "acme.opsengine.enterprise",
        returnTo: "/dashboard",
        exp: Date.now() - 1000, // expired 1s ago
      };
      const b64 = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
      const crypto = require("crypto");
      const secret =
        process.env.SESSION_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        "opsengine-oauth-secure-secret-minimum-32chars!";
      const hmac = crypto.createHmac("sha256", secret).update(b64).digest("base64url");

      const state = `${b64}.${hmac}`;
      expect(verifyGoogleOAuthState(state)).toBeNull();
    });
  });

  describe("Open Redirect Protection", () => {
    it("sanitizes potentially malicious returnTo destinations", () => {
      expect(sanitizeReturnTo("https://evil.com/phish")).toBe("/dashboard");
      expect(sanitizeReturnTo("http://attacker.com")).toBe("/dashboard");
      expect(sanitizeReturnTo("//evil.com")).toBe("/dashboard");
      expect(sanitizeReturnTo("/\\evil.com")).toBe("/dashboard");
      expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/dashboard");
      expect(sanitizeReturnTo(null)).toBe("/dashboard");
      expect(sanitizeReturnTo(undefined)).toBe("/dashboard");
      expect(sanitizeReturnTo("")).toBe("/dashboard");

      // Valid internal paths
      expect(sanitizeReturnTo("/dashboard")).toBe("/dashboard");
      expect(sanitizeReturnTo("/dashboard/reports")).toBe("/dashboard/reports");
      expect(sanitizeReturnTo("/dashboard/documents")).toBe("/dashboard/documents");
    });
  });

  describe("Google OAuth 2.0 Authorization URL Construction", () => {
    it("constructs compliant authorization URL with required scopes and parameters", () => {
      const state = "sample-state-token";
      const redirectUri = "https://opsengine.enterprise/api/auth/google/callback";
      const clientId = "opsengine-google-client-id.apps.googleusercontent.com";

      const urlStr = getGoogleAuthUrl({ state, redirectUri, clientId });
      const url = new URL(urlStr);

      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.pathname).toBe("/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe(clientId);
      expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("scope")).toBe("openid email profile");
      expect(url.searchParams.get("state")).toBe(state);
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("prompt")).toBe("select_account");
    });
  });

  describe("Complete Google SSO Flow & Identity Linking", () => {
    it("authenticates valid tenant user, links Google sub, issues session, and logs audit event", async () => {
      const profile: GoogleProfile = {
        sub: "google-uid-10001",
        email: "admin@acme.opsengine.enterprise",
        email_verified: true,
        name: "Acme Admin User",
      };

      const result = await completeGoogleSSOFlow({
        profile,
        domain: "acme.opsengine.enterprise",
        returnTo: "/dashboard/documents",
      });

      expect(result).toBeDefined();
      expect(result.tenantId).toBe(TENANT_A);
      expect(result.userId).toBe(USER_A);
      expect(result.email).toBe("admin@acme.opsengine.enterprise");
      expect(result.returnTo).toBe("/dashboard/documents");
      expect(typeof result.sessionToken).toBe("string");

      // Verify AuthUser record updated with OAuth link
      const updatedUser = await prisma.authUser.findUnique({
        where: { id: USER_A },
      });
      expect(updatedUser?.oauthProvider).toBe("google");
      expect(updatedUser?.oauthSubject).toBe("google-uid-10001");

      // Verify Session created in database
      const session = await prisma.session.findUnique({
        where: { token: result.sessionToken },
      });
      expect(session).toBeDefined();
      expect(session?.tenantId).toBe(TENANT_A);
      expect(session?.userId).toBe(USER_A);
      expect(session?.revokedAt).toBeNull();

      // Verify session works with authorization context engine
      const ctx = await buildAuthContext(result.sessionToken);
      expect(ctx).not.toBeNull();
      expect(ctx?.tenantId).toBe(TENANT_A);
      expect(ctx?.userId).toBe(USER_A);
      expect(ctx?.membershipStatus).toBe("active");

      // Verify append-only audit event recorded
      const audit = await prisma.auditEvent.findFirst({
        where: {
          tenantId: TENANT_A,
          actorUserId: USER_A,
          eventType: "AUTH_SSO_LOGIN",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).toBeDefined();
      expect(audit?.decision).toBe("allow");
      expect((audit?.metadata as any)?.provider).toBe("google");
      expect((audit?.metadata as any)?.googleSub).toBe("google-uid-10001");
    });

    it("rejects unverified Google emails", async () => {
      const profile: GoogleProfile = {
        sub: "google-uid-unverified",
        email: "admin@acme.opsengine.enterprise",
        email_verified: false,
      };

      await expect(
        completeGoogleSSOFlow({
          profile,
          domain: "acme.opsengine.enterprise",
        })
      ).rejects.toThrow("EMAIL_NOT_VERIFIED");
    });

    it("cross-tenant negative test: rejects authentication when user does not belong to target tenant", async () => {
      // User A belongs to Tenant A; attempting to sign into Tenant B (Starlight) must fail
      const profile: GoogleProfile = {
        sub: "google-uid-cross-tenant",
        email: "admin@acme.opsengine.enterprise",
        email_verified: true,
      };

      await expect(
        completeGoogleSSOFlow({
          profile,
          domain: "starlight.opsengine.enterprise", // Tenant B domain
        })
      ).rejects.toThrow("USER_NOT_ENROLLED");
    });

    it("cross-tenant negative test: rejects authentication when tenant membership is suspended", async () => {
      // Create a test user in Tenant A with suspended membership
      const suspendedUserId = "00000000-0000-4000-8000-000000000099";
      const suspendedEmail = "suspended.user@acme.opsengine.enterprise";

      await prisma.authUser.upsert({
        where: { id: suspendedUserId },
        update: {},
        create: {
          id: suspendedUserId,
          tenantId: TENANT_A,
          email: suspendedEmail,
        },
      });

      await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: TENANT_A, userId: suspendedUserId } },
        update: { status: "suspended" },
        create: {
          id: "00000000-0000-4000-8000-000000000098",
          tenantId: TENANT_A,
          userId: suspendedUserId,
          status: "suspended",
        },
      });

      const profile: GoogleProfile = {
        sub: "google-uid-suspended",
        email: suspendedEmail,
        email_verified: true,
      };

      await expect(
        completeGoogleSSOFlow({
          profile,
          domain: "acme.opsengine.enterprise",
        })
      ).rejects.toThrow("MEMBERSHIP_INACTIVE");

      // Cleanup
      await prisma.tenantMembership.deleteMany({
        where: { tenantId: TENANT_A, userId: suspendedUserId },
      });
      await prisma.authUser.deleteMany({
        where: { id: suspendedUserId },
      });
    });

    it("rejects non-existent or inactive tenant domains", async () => {
      const profile: GoogleProfile = {
        sub: "google-uid-bad-domain",
        email: "someone@nonexistent.domain",
        email_verified: true,
      };

      await expect(
        completeGoogleSSOFlow({
          profile,
          domain: "nonexistent.domain.opsengine",
        })
      ).rejects.toThrow("TENANT_NOT_FOUND");
    });
  });
});
