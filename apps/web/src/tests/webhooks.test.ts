import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  globalWebhookEngine,
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  validateWebhookUrl,
  calculateBackoffDelay,
  isTransientError,
} from "../lib/webhooks";

describe("Module 11 & §14.2 — Outbound Webhook Delivery Engine with HMAC Signatures & DLQ", () => {
  const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
  const TENANT_B = "00000000-0000-4000-8000-0000000000bb";

  beforeEach(() => {
    globalWebhookEngine.reset();
  });

  describe("1. Webhook Secret Generation & Cryptographic HMAC-SHA256 Signatures", () => {
    it("generates a high-entropy secret prefixed with whsec_", () => {
      const secret = generateWebhookSecret();
      expect(secret).toMatch(/^whsec_[a-f0-9]{48}$/);
    });

    it("signs payload and generates valid X-OpsEngine-Signature-256 format", () => {
      const secret = "whsec_test_secret_key_1234567890abcdef";
      const payload = JSON.stringify({ event: "crm.lead.created.v1", leadId: "lead-1" });
      const timestamp = 1700000000;

      const { signatureHeader, signature } = signWebhookPayload(payload, secret, timestamp);

      expect(signatureHeader).toBe(`t=${timestamp},v1=${signature}`);
      expect(signature).toHaveLength(64); // SHA-256 hex string
    });

    it("verifies authentic webhook signature within valid time window", () => {
      const secret = "whsec_sample_secret";
      const payload = JSON.stringify({ amount: 50000, currency: "USD" });
      const now = Math.floor(Date.now() / 1000);

      const { signatureHeader } = signWebhookPayload(payload, secret, now);
      const isValid = verifyWebhookSignature(payload, signatureHeader, secret, 300);

      expect(isValid).toBe(true);
    });

    it("rejects tampered payload content", () => {
      const secret = "whsec_sample_secret";
      const originalPayload = JSON.stringify({ amount: 50000 });
      const tamperedPayload = JSON.stringify({ amount: 999999 });
      const now = Math.floor(Date.now() / 1000);

      const { signatureHeader } = signWebhookPayload(originalPayload, secret, now);
      const isValid = verifyWebhookSignature(tamperedPayload, signatureHeader, secret);

      expect(isValid).toBe(false);
    });

    it("rejects expired or replayed signatures beyond tolerance window", () => {
      const secret = "whsec_sample_secret";
      const payload = JSON.stringify({ action: "transfer" });
      const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

      const { signatureHeader } = signWebhookPayload(payload, secret, staleTimestamp);
      const isValid = verifyWebhookSignature(payload, signatureHeader, secret, 300); // 5 min tolerance

      expect(isValid).toBe(false);
    });

    it("rejects verification with wrong secret key", () => {
      const payload = JSON.stringify({ key: "value" });
      const now = Math.floor(Date.now() / 1000);

      const { signatureHeader } = signWebhookPayload(payload, "whsec_correct_key", now);
      const isValid = verifyWebhookSignature(payload, signatureHeader, "whsec_wrong_key");

      expect(isValid).toBe(false);
    });
  });

  describe("2. Anti-SSRF URL Validation Guardrails", () => {
    it("allows valid public HTTPS destinations", () => {
      const check1 = validateWebhookUrl("https://api.externalcrm.com/v1/webhook");
      const check2 = validateWebhookUrl("https://hooks.zapier.com/hooks/catch/123/abc");
      expect(check1.isValid).toBe(true);
      expect(check2.isValid).toBe(true);
    });

    it("blocks localhost, loopback and internal hostname targets", () => {
      expect(validateWebhookUrl("http://localhost:3000/api").isValid).toBe(false);
      expect(validateWebhookUrl("http://service.local/webhook").isValid).toBe(false);
      expect(validateWebhookUrl("http://app.internal/hook").isValid).toBe(false);
      expect(validateWebhookUrl("http://metadata.google.internal/computeMetadata").isValid).toBe(false);
    });

    it("blocks IPv4 loopback (127.0.0.1)", () => {
      const res = validateWebhookUrl("http://127.0.0.1:8080/events");
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain("private, loopback, or metadata");
    });

    it("blocks AWS and cloud metadata IP (169.254.169.254)", () => {
      const res = validateWebhookUrl("http://169.254.169.254/latest/meta-data/");
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain("private, loopback, or metadata");
    });

    it("blocks private RFC 1918 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)", () => {
      expect(validateWebhookUrl("http://10.0.1.15/receiver").isValid).toBe(false);
      expect(validateWebhookUrl("http://172.20.0.5/api").isValid).toBe(false);
      expect(validateWebhookUrl("http://192.168.1.100:9000/webhook").isValid).toBe(false);
    });

    it("blocks unsupported schemes (ftp, file, gopher)", () => {
      expect(validateWebhookUrl("ftp://files.example.com/hook").isValid).toBe(false);
      expect(validateWebhookUrl("file:///etc/passwd").isValid).toBe(false);
    });
  });

  describe("3. Exponential Backoff & Transient Error Classification", () => {
    it("calculates exponential backoff delay correctly", () => {
      const delay1 = calculateBackoffDelay(1, 1000, 3600000, false); // 1000 * 2^0
      const delay2 = calculateBackoffDelay(2, 1000, 3600000, false); // 1000 * 2^1
      const delay3 = calculateBackoffDelay(3, 1000, 3600000, false); // 1000 * 2^2
      const delay4 = calculateBackoffDelay(4, 1000, 3600000, false); // 1000 * 2^3

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);
      expect(delay4).toBe(8000);
    });

    it("caps exponential backoff at maximum configured duration", () => {
      const delay = calculateBackoffDelay(15, 1000, 10000, false);
      expect(delay).toBe(10000);
    });

    it("classifies transient HTTP errors and network timeouts as retryable", () => {
      expect(isTransientError(408)).toBe(true); // Request Timeout
      expect(isTransientError(429)).toBe(true); // Too Many Requests
      expect(isTransientError(500)).toBe(true); // Internal Server Error
      expect(isTransientError(502)).toBe(true); // Bad Gateway
      expect(isTransientError(503)).toBe(true); // Service Unavailable
      expect(isTransientError(504)).toBe(true); // Gateway Timeout
      expect(isTransientError(null, "fetch failed: ECONNRESET")).toBe(true);
      expect(isTransientError(null, "Socket timeout")).toBe(true);
    });

    it("classifies client 4xx errors as non-transient / non-retryable (PRD §14.2)", () => {
      expect(isTransientError(400)).toBe(false); // Bad Request
      expect(isTransientError(401)).toBe(false); // Unauthorized
      expect(isTransientError(403)).toBe(false); // Forbidden
      expect(isTransientError(404)).toBe(false); // Not Found
      expect(isTransientError(410)).toBe(false); // Gone
      expect(isTransientError(422)).toBe(false); // Unprocessable Entity
    });
  });

  describe("4. Endpoint Management & Event Matching", () => {
    it("registers a webhook endpoint with generated HMAC secret", () => {
      const ep = globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Acme Webhook Hub",
        url: "https://api.acme.org/webhooks",
        eventTypes: ["crm.*", "work.ticket.created.v1"],
        rateLimitPerMinute: 60,
      });

      expect(ep.id).toBeDefined();
      expect(ep.tenantId).toBe(TENANT_A);
      expect(ep.secret).toMatch(/^whsec_/);
      expect(ep.isActive).toBe(true);
      expect(ep.eventTypes).toEqual(["crm.*", "work.ticket.created.v1"]);
    });

    it("matches domain event topics with wildcards and exact names", () => {
      expect(globalWebhookEngine.matchEvent("crm.lead.created.v1", ["*"])).toBe(true);
      expect(globalWebhookEngine.matchEvent("crm.lead.created.v1", ["crm.*"])).toBe(true);
      expect(globalWebhookEngine.matchEvent("finance.invoice.issued.v1", ["crm.*"])).toBe(false);
      expect(globalWebhookEngine.matchEvent("finance.invoice.issued.v1", ["finance.invoice.issued.v1"])).toBe(true);
    });

    it("schedules deliveries only for matching active endpoints in the same tenant", () => {
      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "CRM Listener",
        url: "https://crm.example.com/webhook",
        eventTypes: ["crm.*"],
      });

      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Tickets Listener",
        url: "https://tickets.example.com/webhook",
        eventTypes: ["work.ticket.*"],
      });

      // Scheduled delivery for CRM event
      const deliveries = globalWebhookEngine.scheduleDeliveriesForEvent({
        id: "evt-001",
        name: "crm.lead.created.v1",
        tenantId: TENANT_A,
        payload: { leadId: "lead-101", company: "Globex" },
      });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].eventName).toBe("crm.lead.created.v1");
      expect(deliveries[0].status).toBe("PENDING");
      expect(deliveries[0].attemptCount).toBe(0);
    });

    it("updates webhook attributes and rotates secret upon request", () => {
      const ep = globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Initial Name",
        url: "https://initial.example.com/hook",
        eventTypes: ["*"],
      });

      const oldSecret = ep.secret;

      const updated = globalWebhookEngine.updateEndpoint(TENANT_A, ep.id, {
        name: "Updated Name",
        rotateSecret: true,
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.secret).not.toBe(oldSecret);
      expect(updated.secret).toMatch(/^whsec_/);
    });

    it("deletes a webhook endpoint", () => {
      const ep = globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Temp Hook",
        url: "https://temp.example.com/hook",
        eventTypes: ["*"],
      });

      const deleted = globalWebhookEngine.deleteEndpoint(TENANT_A, ep.id);
      expect(deleted).toBe(true);
      expect(globalWebhookEngine.getEndpoint(TENANT_A, ep.id)).toBeNull();
    });
  });

  describe("5. Delivery Dispatch, Backoff Retries & Dead Letter Queue (DLQ)", () => {
    it("dispatches successful delivery and records response status & latency", async () => {
      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Fast Receiver",
        url: "https://fast.example.com/webhook",
        eventTypes: ["*"],
      });

      const [delivery] = globalWebhookEngine.scheduleDeliveriesForEvent({
        id: "evt-success",
        name: "project.milestone.accepted.v1",
        tenantId: TENANT_A,
        payload: { milestoneId: "ms-1" },
      });

      // Mock successful fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{"received": true}',
      });

      const result = await globalWebhookEngine.dispatchDelivery(delivery.id, mockFetch as any);

      expect(result.status).toBe("SUCCESS");
      expect(result.attemptCount).toBe(1);
      expect(result.responseStatus).toBe(200);
      expect(result.executionLatencyMs).toBeGreaterThanOrEqual(0);
      expect(result.requestHeaders["X-OpsEngine-Signature-256"]).toBeDefined();
      expect(result.requestHeaders["X-OpsEngine-Event-Type"]).toBe("project.milestone.accepted.v1");
    });

    it("schedules exponential retry for transient 500 error", async () => {
      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Flaky Receiver",
        url: "https://flaky.example.com/webhook",
        eventTypes: ["*"],
      });

      const [delivery] = globalWebhookEngine.scheduleDeliveriesForEvent({
        id: "evt-transient",
        name: "work.ticket.status_changed.v1",
        tenantId: TENANT_A,
        payload: { ticketId: "t-1" },
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      });

      const result = await globalWebhookEngine.dispatchDelivery(delivery.id, mockFetch as any);

      expect(result.status).toBe("FAILED");
      expect(result.attemptCount).toBe(1);
      expect(result.nextAttemptAt).toBeDefined();
      expect(result.errorDetails).toContain("Transient failure");
    });

    it("immediately transitions non-transient 400 error to DEAD_LETTER without retrying", async () => {
      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Strict Receiver",
        url: "https://strict.example.com/webhook",
        eventTypes: ["*"],
      });

      const [delivery] = globalWebhookEngine.scheduleDeliveriesForEvent({
        id: "evt-bad-request",
        name: "finance.invoice.issued.v1",
        tenantId: TENANT_A,
        payload: { invoiceId: "inv-001" },
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request: Schema Mismatch",
      });

      const result = await globalWebhookEngine.dispatchDelivery(delivery.id, mockFetch as any);

      expect(result.status).toBe("DEAD_LETTER");
      expect(result.nextAttemptAt).toBeNull();
      expect(result.errorDetails).toContain("Non-transient or exhausted retries");
    });

    it("exhausts retries and transitions to DEAD_LETTER on maximum attempts (5)", async () => {
      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Down Receiver",
        url: "https://down.example.com/webhook",
        eventTypes: ["*"],
      });

      const [delivery] = globalWebhookEngine.scheduleDeliveriesForEvent({
        id: "evt-down",
        name: "recruitment.offer.accepted.v1",
        tenantId: TENANT_A,
        payload: { candidateId: "c-1" },
      });

      const mockFetch = vi.fn().mockRejectedValue(new Error("ETIMEDOUT: Connection timed out"));

      // Dispatch 5 consecutive times
      for (let i = 1; i <= 5; i++) {
        await globalWebhookEngine.dispatchDelivery(delivery.id, mockFetch as any);
      }

      const dlq = globalWebhookEngine.getDeadLetterQueue(TENANT_A);
      expect(dlq).toHaveLength(1);
      expect(dlq[0].id).toBe(delivery.id);
      expect(dlq[0].status).toBe("DEAD_LETTER");
      expect(dlq[0].attemptCount).toBe(5);
    });

    it("replays a dead-lettered delivery and resets attempt counter", async () => {
      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Recovered Receiver",
        url: "https://recovered.example.com/webhook",
        eventTypes: ["*"],
      });

      const [delivery] = globalWebhookEngine.scheduleDeliveriesForEvent({
        id: "evt-replay",
        name: "attendance.punch.recorded.v1",
        tenantId: TENANT_A,
        payload: { employeeId: "emp-1" },
      });

      // Force into DEAD_LETTER
      delivery.status = "DEAD_LETTER";
      delivery.attemptCount = 5;

      const mockSuccessFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "OK",
      });

      const replayed = await globalWebhookEngine.replayDelivery(
        TENANT_A,
        delivery.id,
        true,
        mockSuccessFetch as any
      );

      expect(replayed.status).toBe("SUCCESS");
      expect(replayed.attemptCount).toBe(1);
      expect(globalWebhookEngine.getDeadLetterQueue(TENANT_A)).toHaveLength(0);
    });
  });

  describe("6. Strict Multi-Tenant Negative Isolation", () => {
    it("prevents Tenant B from viewing or mutating Tenant A webhook endpoints", () => {
      const epA = globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Tenant A Secret Hook",
        url: "https://a.example.com/hook",
        eventTypes: ["*"],
      });

      // Tenant B queries Tenant A webhook
      expect(globalWebhookEngine.getEndpoint(TENANT_B, epA.id)).toBeNull();

      // Tenant B tries to delete Tenant A webhook
      const deleted = globalWebhookEngine.deleteEndpoint(TENANT_B, epA.id);
      expect(deleted).toBe(false);

      // Tenant B tries to update Tenant A webhook
      expect(() =>
        globalWebhookEngine.updateEndpoint(TENANT_B, epA.id, { name: "Hijacked" })
      ).toThrow("Webhook endpoint not found or access denied");
    });

    it("prevents Tenant B from seeing or replaying Tenant A DLQ deliveries", async () => {
      globalWebhookEngine.registerEndpoint(TENANT_A, {
        name: "Tenant A Hook",
        url: "https://a.example.com/hook",
        eventTypes: ["*"],
      });

      const [deliveryA] = globalWebhookEngine.scheduleDeliveriesForEvent({
        id: "evt-tenant-a",
        name: "crm.account.created.v1",
        tenantId: TENANT_A,
        payload: { secretData: "confidential" },
      });

      deliveryA.status = "DEAD_LETTER";

      // Tenant B DLQ must be empty
      const dlqB = globalWebhookEngine.getDeadLetterQueue(TENANT_B);
      expect(dlqB).toHaveLength(0);

      // Tenant B attempting to replay Tenant A delivery must fail
      await expect(
        globalWebhookEngine.replayDelivery(TENANT_B, deliveryA.id, false)
      ).rejects.toThrow("Webhook delivery not found or cross-tenant access denied");
    });
  });
});
