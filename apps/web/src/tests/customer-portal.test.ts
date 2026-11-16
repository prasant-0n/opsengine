import { describe, it, expect } from "vitest";
import {
  PORTAL_TICKET_TYPES,
  PORTAL_TICKET_PRIORITIES,
  SLA_TARGETS,
  calculateSlaTarget,
  getSlaStatus,
  isValidPortalTicketType,
  isValidPortalTicketPriority,
  sanitizeTicketComments,
  generateDeliverableSignatureHash,
} from "../features/portal/lib/portal-sla";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { scopeAllows, ResourceScope } from "../lib/permissions/scopes";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #38: Customer Self-Service Support Portal", () => {
  describe("1. Ticket Classification & Priority Matrix", () => {
    it("recognizes all standard portal ticket types", () => {
      expect(isValidPortalTicketType("bug")).toBe(true);
      expect(isValidPortalTicketType("service_request")).toBe(true);
      expect(isValidPortalTicketType("question")).toBe(true);
      expect(isValidPortalTicketType("incident")).toBe(true);
      expect(isValidPortalTicketType("invalid_type")).toBe(false);
    });

    it("recognizes all ticket priority levels", () => {
      expect(isValidPortalTicketPriority("low")).toBe(true);
      expect(isValidPortalTicketPriority("medium")).toBe(true);
      expect(isValidPortalTicketPriority("high")).toBe(true);
      expect(isValidPortalTicketPriority("urgent")).toBe(true);
      expect(isValidPortalTicketPriority("extreme")).toBe(false);
    });
  });

  describe("2. SLA Calculation & Adherence Engine", () => {
    it("computes accurate response and resolution targets by priority", () => {
      const base = new Date("2026-11-17T10:00:00.000Z");

      // Urgent: 1h response, 4h resolution
      const urgentRes = calculateSlaTarget("urgent", base, "response");
      const urgentResolve = calculateSlaTarget("urgent", base, "resolution");
      expect(urgentRes.toISOString()).toBe("2026-11-17T11:00:00.000Z");
      expect(urgentResolve.toISOString()).toBe("2026-11-17T14:00:00.000Z");

      // High: 4h response, 12h resolution
      const highRes = calculateSlaTarget("high", base, "response");
      const highResolve = calculateSlaTarget("high", base, "resolution");
      expect(highRes.toISOString()).toBe("2026-11-17T14:00:00.000Z");
      expect(highResolve.toISOString()).toBe("2026-11-17T22:00:00.000Z");

      // Medium: 8h response, 24h resolution
      const medResolve = calculateSlaTarget("medium", base, "resolution");
      expect(medResolve.toISOString()).toBe("2026-11-18T10:00:00.000Z");

      // Low: 24h response, 72h resolution
      const lowResolve = calculateSlaTarget("low", base, "resolution");
      expect(lowResolve.toISOString()).toBe("2026-11-20T10:00:00.000Z");
    });

    it("evaluates active ticket SLA adherence accurately", () => {
      const futureDue = new Date(Date.now() + 5 * 3600 * 1000);
      const status = getSlaStatus(futureDue);
      expect(status.isBreached).toBe(false);
      expect(status.hoursRemaining).toBeGreaterThanOrEqual(4);
      expect(status.label).toContain("remaining");
    });

    it("evaluates breached ticket SLA adherence accurately", () => {
      const pastDue = new Date(Date.now() - 3 * 3600 * 1000);
      const status = getSlaStatus(pastDue);
      expect(status.isBreached).toBe(true);
      expect(status.label).toContain("Breached by");
    });

    it("evaluates resolved ticket adherence against resolution timestamp", () => {
      const due = new Date("2026-11-17T15:00:00.000Z");
      const resolvedBefore = new Date("2026-11-17T14:30:00.000Z");
      const resolvedAfter = new Date("2026-11-17T16:30:00.000Z");

      const okStatus = getSlaStatus(due, resolvedBefore);
      expect(okStatus.isBreached).toBe(false);

      const breachedStatus = getSlaStatus(due, resolvedAfter);
      expect(breachedStatus.isBreached).toBe(true);
    });
  });

  describe("3. Anti-Leakage Comment Filtration Guardrail", () => {
    it("purges internal staff deliberations from client view", () => {
      const mixedComments = [
        { id: "c1", body: "Hello customer, we are working on this.", isInternal: false },
        { id: "c2", body: "Private note: Root cause is legacy DB lock.", isInternal: true },
        { id: "c3", body: "Customer update: Fix deployed to staging.", isInternal: false },
        { id: "c4", body: "Private note: Client SLA might breach in 30 mins.", isInternal: true },
      ];

      const sanitized = sanitizeTicketComments(mixedComments);
      expect(sanitized).toHaveLength(2);
      expect(sanitized.map((c) => c.id)).toEqual(["c1", "c3"]);
      expect(sanitized.every((c) => !c.isInternal)).toBe(true);
    });

    it("handles empty or already sanitized comment streams safely", () => {
      expect(sanitizeTicketComments([])).toEqual([]);
      const publicOnly = [{ id: "c1", body: "Public reply", isInternal: false }];
      expect(sanitizeTicketComments(publicOnly)).toEqual(publicOnly);
    });
  });

  describe("4. Cryptographic Formal Sign-Off Hash Generation", () => {
    it("generates deterministic SHA-256 digital signature hashes", () => {
      const input = {
        deliverableId: "deliv-123",
        accountId: "acc-456",
        signerEmail: "cfo@acme.com",
        status: "approved",
        timestamp: "2026-11-17T12:00:00.000Z",
      };

      const hash1 = generateDeliverableSignatureHash(input);
      const hash2 = generateDeliverableSignatureHash(input);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 256 bits = 64 hex characters
    });

    it("produces distinct cryptographic proof when any input is modified", () => {
      const baseInput = {
        deliverableId: "deliv-123",
        accountId: "acc-456",
        signerEmail: "cfo@acme.com",
        status: "approved",
        timestamp: "2026-11-17T12:00:00.000Z",
      };

      const approvedHash = generateDeliverableSignatureHash(baseInput);
      const changesRequestedHash = generateDeliverableSignatureHash({
        ...baseInput,
        status: "changes_requested",
      });
      const differentEmailHash = generateDeliverableSignatureHash({
        ...baseInput,
        signerEmail: "cto@acme.com",
      });

      expect(approvedHash).not.toBe(changesRequestedHash);
      expect(approvedHash).not.toBe(differentEmailHash);
    });
  });

  describe("5. ReBAC & Account-Level Isolation (Anti-IDOR)", () => {
    const mockContext: AuthorizationContext = {
      tenantId: "tenant-alpha",
      userId: "user-client-1",
      employeeId: null,
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        {
          key: PERMISSIONS.PORTAL_TICKET_READ,
          scopeType: "ACCOUNT",
          scopeId: "account-alpha-1",
          validTo: null,
        },
        {
          key: PERMISSIONS.PORTAL_DELIVERABLE_SIGNOFF,
          scopeType: "ACCOUNT",
          scopeId: "account-alpha-1",
          validTo: null,
        },
      ],
      roles: [{ key: "client", scopeType: "ACCOUNT", scopeId: "account-alpha-1" }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows access to resources within the bound account scope", () => {
      const resource: ResourceScope = {
        tenantId: "tenant-alpha",
        accountId: "account-alpha-1",
      };

      const isAllowed = scopeAllows(mockContext, "ACCOUNT", "account-alpha-1", resource);
      expect(isAllowed).toBe(true);
    });

    it("strictly blocks cross-account IDOR within the same tenant", () => {
      const attackerResource: ResourceScope = {
        tenantId: "tenant-alpha",
        accountId: "account-alpha-2", // Different account!
      };

      const isAllowed = scopeAllows(mockContext, "ACCOUNT", "account-alpha-1", attackerResource);
      expect(isAllowed).toBe(false);
    });

    it("strictly blocks access when resource accountId is missing", () => {
      const missingAccount: ResourceScope = {
        tenantId: "tenant-alpha",
        accountId: null,
      };

      const isAllowed = scopeAllows(mockContext, "ACCOUNT", "account-alpha-1", missingAccount);
      expect(isAllowed).toBe(false);
    });
  });
});
