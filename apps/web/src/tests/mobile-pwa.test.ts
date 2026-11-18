import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import manifest from "../app/manifest";
import {
  generateVapidKeyPair,
  getVapidKeys,
  createVapidAuthorizationHeader,
  validatePushEndpoint,
  sendWebPushNotification,
} from "../features/pwa/lib/push-service";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { scopeAllows, ResourceScope } from "../lib/permissions/scopes";
import { authorize } from "../lib/permissions/engine";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #42: Mobile PWA & Push Notifications", () => {
  describe("1. Web App Manifest & Service Worker Specifications", () => {
    it("provides valid static manifest.json with standalone display mode and icons", () => {
      const manifestPath = path.resolve(__dirname, "../../public/manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const raw = fs.readFileSync(manifestPath, "utf-8");
      const data = JSON.parse(raw);

      expect(data.name).toBe("OpsEngine Enterprise Platform");
      expect(data.short_name).toBe("OpsEngine");
      expect(data.display).toBe("standalone");
      expect(data.background_color).toBe("#0B0F17");
      expect(data.theme_color).toBe("#3B82F6");
      expect(data.start_url).toBe("/dashboard");
      expect(Array.isArray(data.icons)).toBe(true);
      expect(data.icons.length).toBeGreaterThanOrEqual(2);
      expect(data.icons.some((i: { sizes: string }) => i.sizes === "192x192")).toBe(true);
      expect(data.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
      expect(Array.isArray(data.shortcuts)).toBe(true);
      expect(data.shortcuts.length).toBeGreaterThanOrEqual(3);
    });

    it("generates compliant Next.js App Router metadata manifest", () => {
      const dynamicManifest = manifest();
      expect(dynamicManifest.name).toBe("OpsEngine Enterprise Platform");
      expect(dynamicManifest.short_name).toBe("OpsEngine");
      expect(dynamicManifest.display).toBe("standalone");
      expect(dynamicManifest.theme_color).toBe("#3B82F6");
      expect(dynamicManifest.start_url).toBe("/dashboard");
      expect(dynamicManifest.icons).toBeDefined();
      expect(dynamicManifest.icons!.length).toBeGreaterThanOrEqual(2);
    });

    it("verifies production service worker exists with cache, push, and notification handlers", () => {
      const swPath = path.resolve(__dirname, "../../public/sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, "utf-8");
      expect(swContent).toContain("CACHE_NAME");
      expect(swContent).toContain("addEventListener(\"install\"");
      expect(swContent).toContain("addEventListener(\"activate\"");
      expect(swContent).toContain("addEventListener(\"fetch\"");
      expect(swContent).toContain("addEventListener(\"push\"");
      expect(swContent).toContain("addEventListener(\"notificationclick\"");
      expect(swContent).toContain("showNotification");
    });
  });

  describe("2. VAPID Keypair Generation & Web Push Cryptography", () => {
    it("generates an uncompressed P-256 base64url public key and PKCS#8 private key", () => {
      const keys = generateVapidKeyPair();
      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      // Uncompressed 65-byte EC public key in base64url is 87 characters
      expect(keys.publicKey.length).toBe(87);
      expect(keys.privateKey).toContain("BEGIN PRIVATE KEY");
    });

    it("retrieves cached or generated VAPID keys idempotently", () => {
      const key1 = getVapidKeys();
      const key2 = getVapidKeys();
      expect(key1.publicKey).toBe(key2.publicKey);
      expect(key1.privateKey).toBe(key2.privateKey);
    });

    it("constructs RFC 8292 compliant VAPID Authorization header with ES256 JWT signature", () => {
      const endpoint = "https://fcm.googleapis.com/fcm/send/sample-device-token-12345";
      const subject = "mailto:admin@opsengine.com";
      const { header, token } = createVapidAuthorizationHeader(endpoint, subject);

      expect(header).toMatch(/^vapid t=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+, k=[A-Za-z0-9_-]+$/);
      expect(token).toBeDefined();

      const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
      expect(encodedHeader).toBeDefined();
      expect(encodedPayload).toBeDefined();
      expect(encodedSignature).toBeDefined();

      const decodedHeader = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf-8"));
      expect(decodedHeader.typ).toBe("JWT");
      expect(decodedHeader.alg).toBe("ES256");

      const decodedPayload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
      expect(decodedPayload.aud).toBe("https://fcm.googleapis.com");
      expect(decodedPayload.sub).toBe(subject);
      expect(decodedPayload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe("3. Anti-SSRF Push Endpoint Validation", () => {
    it("accepts valid Web Push gateway endpoints from recognized providers", () => {
      const validEndpoints = [
        "https://fcm.googleapis.com/fcm/send/abc-123",
        "https://android.googleapis.com/gcm/send/def-456",
        "https://updates.push.services.mozilla.com/wpush/v2/ghi-789",
        "https://web.push.apple.com/QN5sP-jL",
        "https://client.wns.windows.com/notify/jkl-012",
      ];

      for (const ep of validEndpoints) {
        const result = validatePushEndpoint(ep);
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      }
    });

    it("rejects non-HTTPS endpoints", () => {
      const result = validatePushEndpoint("http://fcm.googleapis.com/fcm/send/abc");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("HTTPS");
    });

    it("rejects internal network, loopback, and cloud metadata endpoints", () => {
      const blockedEndpoints = [
        "https://localhost/push",
        "https://127.0.0.1:8080/push",
        "https://169.254.169.254/latest/meta-data/",
        "https://10.0.0.5/gateway",
        "https://192.168.1.100/webhook",
        "https://172.20.0.1/notify",
        "https://corp-internal.local/push",
      ];

      for (const ep of blockedEndpoints) {
        const result = validatePushEndpoint(ep);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("Internal or private network endpoints are forbidden.");
      }
    });

    it("rejects arbitrary unapproved third-party hostnames", () => {
      const result = validatePushEndpoint("https://malicious-attacker-host.com/fcm");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("not in the recognized Web Push allowlist");
    });
  });

  describe("4. Push Notification Dispatch & Mock Engine", () => {
    it("successfully formats and dispatches push notifications in mock test mode", async () => {
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-device-mock",
        p256dh: "mock_p256dh_public_key_string",
        auth: "mock_auth_secret_key",
      };

      const result = await sendWebPushNotification(subscription, {
        title: "Urgent Expense Approval Required",
        body: "Elena Rostova submitted expense report EXP-2026-004 ($420.00)",
        url: "/dashboard/approvals",
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
    });

    it("aborts dispatch immediately for SSRF disallowed endpoints", async () => {
      const subscription = {
        endpoint: "https://127.0.0.1:9000/internal-admin",
        p256dh: "key",
        auth: "secret",
      };

      const result = await sendWebPushNotification(subscription, {
        title: "Test",
        body: "Payload",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Internal or private network");
    });
  });

  describe("5. ReBAC Scoping, Self-Registration & Cross-Tenant Isolation", () => {
    const tenantA = "00000000-0000-4000-8000-000000000001";
    const tenantB = "00000000-0000-4000-8000-000000000002";
    const employeeAlice = "11111111-1111-4000-8000-111111111111";
    const employeeBob = "22222222-2222-4000-8000-222222222222";

    const aliceContext: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-alice",
      employeeId: employeeAlice,
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        {
          key: PERMISSIONS.NOTIFICATION_PUSH_SUBSCRIBE,
          scopeType: "SELF",
          scopeId: null,
          validTo: null,
        },
      ],
      roles: [{ key: "employee", scopeType: "SELF", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows employee to register their own device subscription under SELF scope", () => {
      const resource: ResourceScope = {
        tenantId: tenantA,
        owningEmployeeId: employeeAlice,
      };

      const isAllowed = scopeAllows(aliceContext, "SELF", null, resource);
      expect(isAllowed).toBe(true);
    });

    it("denies employee from modifying or registering subscriptions for another employee", () => {
      const resource: ResourceScope = {
        tenantId: tenantA,
        owningEmployeeId: employeeBob,
      };

      const isAllowed = scopeAllows(aliceContext, "SELF", null, resource);
      expect(isAllowed).toBe(false);
    });

    it("strictly isolates push subscriptions across tenant boundaries", () => {
      const tenantBResource = {
        tenantId: tenantB,
        owningEmployeeId: employeeBob,
        resourceType: "push_subscription",
      };

      const decision = authorize(aliceContext, PERMISSIONS.NOTIFICATION_PUSH_SUBSCRIBE, tenantBResource);
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("TENANT_MISMATCH");
    });

    it("allows administrators to broadcast push notifications under TENANT scope", () => {
      const adminContext: AuthorizationContext = {
        tenantId: tenantA,
        userId: "user-admin",
        employeeId: employeeAlice,
        membershipStatus: "active",
        assurance: { mfa: false },
        permissions: [
          {
            key: PERMISSIONS.NOTIFICATION_PUSH_BROADCAST,
            scopeType: "TENANT",
            scopeId: null,
            validTo: null,
          },
        ],
        roles: [{ key: "senior_lead", scopeType: "TENANT", scopeId: null }],
        teamMemberships: [],
        reporting: { managerIds: [], reportIds: [] },
        accessGroupIds: [],
        policyVersion: 1,
        builtAt: Date.now(),
      };

      const decision = authorize(adminContext, PERMISSIONS.NOTIFICATION_PUSH_BROADCAST, {
        tenantId: tenantA,
        resourceType: "push_broadcast",
      });

      expect(decision.allowed).toBe(true);
    });
  });
});
