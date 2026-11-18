import { describe, it, expect } from "vitest";
import {
  calculateTripDurationDays,
  getDestinationTier,
  evaluatePerDiemCompliance,
  deriveTravelerDutyStatus,
  calculateItineraryTotalCents,
  buildExpenseBridgeDraft,
  serializeTravelRequest,
} from "../features/travel/lib/travel-engine";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { authorize } from "../lib/permissions/engine";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #46 — Travel Management & Corporate Itinerary Booking", () => {
  describe("Domain Engine: Trip Duration Calculation", () => {
    it("evaluates a same-day journey as 1 calendar day", () => {
      const days = calculateTripDurationDays("2026-12-01T08:00:00Z", "2026-12-01T20:00:00Z");
      expect(days).toBe(1);
    });

    it("evaluates multi-day trips inclusively", () => {
      // Dec 1 to Dec 5 inclusive = 5 days
      const days = calculateTripDurationDays("2026-12-01T00:00:00Z", "2026-12-05T23:59:59Z");
      expect(days).toBe(5);
    });

    it("throws an error if end date precedes start date", () => {
      expect(() => {
        calculateTripDurationDays("2026-12-05T00:00:00Z", "2026-12-01T00:00:00Z");
      }).toThrow("Trip end date cannot be earlier than start date");
    });

    it("throws an error on invalid date inputs", () => {
      expect(() => {
        calculateTripDurationDays("not-a-date", "2026-12-01T00:00:00Z");
      }).toThrow("Invalid start or end date provided");
    });
  });

  describe("Domain Engine: Per-Diem Destination Tiers & Compliance", () => {
    it("correctly identifies Tier 1 high-cost global metropolises", () => {
      expect(getDestinationTier("London")).toBe("tier_1");
      expect(getDestinationTier("New York")).toBe("tier_1");
      expect(getDestinationTier("Tokyo")).toBe("tier_1");
      expect(getDestinationTier("San Francisco")).toBe("tier_1");
    });

    it("correctly identifies Tier 2 major commercial cities", () => {
      expect(getDestinationTier("Berlin")).toBe("tier_2");
      expect(getDestinationTier("Toronto")).toBe("tier_2");
      expect(getDestinationTier("Bangalore")).toBe("tier_2");
      expect(getDestinationTier("Chicago")).toBe("tier_2");
    });

    it("falls back to Tier 3 for regional secondary cities", () => {
      expect(getDestinationTier("Omaha")).toBe("tier_3");
      expect(getDestinationTier("Cardiff")).toBe("tier_3");
      expect(getDestinationTier("")).toBe("tier_3");
    });

    it("approves compliant trip estimate within per-diem caps", () => {
      // 4 days in London (Tier 1 limit: $350/day -> Max: $1,400)
      // Estimated: $1,200 (120,000 cents)
      const res = evaluatePerDiemCompliance(120000n, 4, "tier_1");
      expect(res.compliant).toBe(true);
      expect(res.dailyRateCents).toBe(30000); // $300/day
      expect(res.maxAllowedTotalCents).toBe(140000); // $1,400
      expect(res.varianceCents).toBe(-20000); // -$200 under cap
    });

    it("flags non-compliant trip estimate exceeding per-diem limit", () => {
      // 3 days in Berlin (Tier 2 limit: $220/day -> Max: $660)
      // Estimated: $900 (90,000 cents)
      const res = evaluatePerDiemCompliance(90000, 3, "tier_2");
      expect(res.compliant).toBe(false);
      expect(res.dailyRateCents).toBe(30000); // $300/day
      expect(res.maxAllowedTotalCents).toBe(66000); // $660
      expect(res.varianceCents).toBe(24000); // +$240 over cap
    });
  });

  describe("Domain Engine: Live Traveler Duty of Care Status", () => {
    it("returns 'planned' for upcoming missions", () => {
      const status = deriveTravelerDutyStatus(
        "2026-12-10T00:00:00Z",
        "2026-12-15T00:00:00Z",
        "submitted",
        new Date("2026-11-20T00:00:00Z")
      );
      expect(status).toBe("planned");
    });

    it("returns 'in_transit' on the travel departure day", () => {
      const status = deriveTravelerDutyStatus(
        "2026-12-10T00:00:00Z",
        "2026-12-15T00:00:00Z",
        "finance_approved",
        new Date("2026-12-10T14:30:00Z")
      );
      expect(status).toBe("in_transit");
    });

    it("returns 'on_site' during the active mission duration", () => {
      const status = deriveTravelerDutyStatus(
        "2026-12-10T00:00:00Z",
        "2026-12-15T00:00:00Z",
        "finance_approved",
        new Date("2026-12-12T12:00:00Z")
      );
      expect(status).toBe("on_site");
    });

    it("returns 'returned' after the trip end date has elapsed", () => {
      const status = deriveTravelerDutyStatus(
        "2026-12-10T00:00:00Z",
        "2026-12-15T00:00:00Z",
        "completed",
        new Date("2026-12-20T00:00:00Z")
      );
      expect(status).toBe("returned");
    });

    it("returns 'cancelled' if travel request was rejected or cancelled", () => {
      const status = deriveTravelerDutyStatus(
        "2026-12-10T00:00:00Z",
        "2026-12-15T00:00:00Z",
        "rejected",
        new Date("2026-12-12T00:00:00Z")
      );
      expect(status).toBe("cancelled");
    });
  });

  describe("Domain Engine: Itinerary Aggregation & Expense Bridging", () => {
    it("aggregates itinerary costs accurately with BigInt", () => {
      const items = [
        { costCents: 85000n }, // Flight: $850
        { costCents: 60000n }, // Hotel: $600
        { costCents: 15000n }, // Train: $150
      ];
      const total = calculateItineraryTotalCents(items);
      expect(total).toBe(160000n);
    });

    it("bridges approved travel request into ExpenseReport draft with categorized items", () => {
      const request = {
        id: "req-12345678-abcd",
        title: "London Client Summit",
        currency: "USD",
        estimatedTotalCents: 150000n,
        advanceAmountCents: 40000n, // $400 advance
        destinationCity: "London",
        employeeId: "emp-elena",
      };

      const items = [
        {
          type: "flight",
          carrierOrVendor: "British Airways",
          costCents: 85000n,
          bookingReference: "BA-991",
        },
        {
          type: "hotel",
          carrierOrVendor: "Hilton London",
          costCents: 65000n,
          bookingReference: "HLT-441",
        },
      ];

      const draft = buildExpenseBridgeDraft(request, items);

      expect(draft.linkedTravelRequestId).toBe("req-12345678-abcd");
      expect(draft.currency).toBe("USD");
      expect(draft.totalAmountCents).toBe(150000n);
      expect(draft.items).toHaveLength(2);
      expect(draft.items[0].category).toBe("travel");
      expect(draft.items[0].description).toContain("FLIGHT: British Airways (Ref: BA-991)");
      expect(draft.items[1].category).toBe("lodging");
      expect(draft.items[1].description).toContain("HOTEL: Hilton London (Ref: HLT-441)");
      expect(draft.description).toContain("Disbursed cash advance: $400.00 USD");
    });

    it("falls back to request estimate if no itinerary items are logged", () => {
      const request = {
        id: "req-fallback",
        title: "Client Site Visit",
        currency: "USD",
        estimatedTotalCents: 75000n,
        advanceAmountCents: 0n,
        destinationCity: "Seattle",
        employeeId: "emp-1",
      };

      const draft = buildExpenseBridgeDraft(request, []);
      expect(draft.totalAmountCents).toBe(75000n);
      expect(draft.items).toHaveLength(1);
      expect(draft.items[0].category).toBe("travel");
      expect(draft.items[0].description).toContain("Travel to Seattle");
    });

    it("serializes BigInt fields cleanly for JSON transport", () => {
      const rawReq = {
        id: "req-1",
        estimatedTotalCents: 150000n,
        advanceAmountCents: 50000n,
        itineraryItems: [{ id: "item-1", costCents: 85000n }],
      };

      const serialized = serializeTravelRequest(rawReq);
      expect(serialized.estimatedTotalCents).toBe("150000");
      expect(serialized.advanceAmountCents).toBe("50000");
      expect(serialized.itineraryItems[0].costCents).toBe("85000");
    });
  });

  describe("ReBAC & Multi-Tenant Authorization Enforcement", () => {
    const tenantA = "00000000-0000-4000-8000-000000000001";
    const tenantB = "00000000-0000-4000-8000-000000000002";

    const employeeCtx: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-dev1",
      employeeId: "emp-dev1",
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        { key: PERMISSIONS.TRAVEL_REQUEST_CREATE, scopeType: "SELF", scopeId: null, validTo: null },
        { key: PERMISSIONS.TRAVEL_REQUEST_READ_SELF, scopeType: "SELF", scopeId: null, validTo: null },
      ],
      roles: [{ key: "employee", scopeType: "TENANT", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: ["emp-lead1"], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    const managerCtx: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-lead1",
      employeeId: "emp-lead1",
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        { key: PERMISSIONS.TRAVEL_REQUEST_CREATE, scopeType: "SELF", scopeId: null, validTo: null },
        { key: PERMISSIONS.TRAVEL_REQUEST_READ_SELF, scopeType: "SELF", scopeId: null, validTo: null },
        { key: PERMISSIONS.TRAVEL_REQUEST_READ_TEAM, scopeType: "TEAM", scopeId: null, validTo: null },
        { key: PERMISSIONS.TRAVEL_APPROVE_MANAGER, scopeType: "TEAM", scopeId: null, validTo: null },
      ],
      roles: [{ key: "lead", scopeType: "TENANT", scopeId: null }],
      teamMemberships: [{ teamId: "team-alpha", responsibility: "lead", validTo: null }],
      reporting: { managerIds: [], reportIds: ["emp-dev1"] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    const financeCtx: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-fin1",
      employeeId: "emp-fin1",
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        { key: PERMISSIONS.TRAVEL_REQUEST_CREATE, scopeType: "SELF", scopeId: null, validTo: null },
        { key: PERMISSIONS.TRAVEL_REQUEST_READ_SELF, scopeType: "SELF", scopeId: null, validTo: null },
        { key: PERMISSIONS.TRAVEL_APPROVE_FINANCE, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.TRAVEL_DISBURSE_ADVANCE, scopeType: "TENANT", scopeId: null, validTo: null },
      ],
      roles: [{ key: "finance", scopeType: "TENANT", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows employee to create and read their own travel requests", () => {
      const ownRequest = {
        tenantId: tenantA,
        owningEmployeeId: "emp-dev1",
        resourceType: "travel_request",
      };

      const createAuth = authorize(employeeCtx, PERMISSIONS.TRAVEL_REQUEST_CREATE, ownRequest);
      expect(createAuth.allowed).toBe(true);

      const readAuth = authorize(employeeCtx, PERMISSIONS.TRAVEL_REQUEST_READ_SELF, ownRequest);
      expect(readAuth.allowed).toBe(true);
    });

    it("denies regular employee from approving travel requests", () => {
      const req = {
        tenantId: tenantA,
        owningEmployeeId: "emp-dev2",
        resourceType: "travel_request",
      };

      const managerApprove = authorize(employeeCtx, PERMISSIONS.TRAVEL_APPROVE_MANAGER, req);
      expect(managerApprove.allowed).toBe(false);

      const financeApprove = authorize(employeeCtx, PERMISSIONS.TRAVEL_APPROVE_FINANCE, req);
      expect(financeApprove.allowed).toBe(false);
    });

    it("allows team lead to review and approve reporting employee's travel", () => {
      const teamReq = {
        tenantId: tenantA,
        owningEmployeeId: "emp-dev1",
        teamIds: ["team-alpha"],
        resourceType: "travel_request",
      };

      const readTeam = authorize(managerCtx, PERMISSIONS.TRAVEL_REQUEST_READ_TEAM, teamReq);
      expect(readTeam.allowed).toBe(true);

      const approveMgr = authorize(managerCtx, PERMISSIONS.TRAVEL_APPROVE_MANAGER, teamReq);
      expect(approveMgr.allowed).toBe(true);
    });

    it("allows finance officer to approve and disburse advance across tenant", () => {
      const anyReq = {
        tenantId: tenantA,
        owningEmployeeId: "emp-dev1",
        resourceType: "travel_request",
      };

      const finApprove = authorize(financeCtx, PERMISSIONS.TRAVEL_APPROVE_FINANCE, anyReq);
      expect(finApprove.allowed).toBe(true);

      const advanceDisburse = authorize(financeCtx, PERMISSIONS.TRAVEL_DISBURSE_ADVANCE, anyReq);
      expect(advanceDisburse.allowed).toBe(true);
    });

    it("strictly isolates travel requests across tenant boundaries (cross-tenant negative test)", () => {
      const crossTenantReq = {
        tenantId: tenantB,
        owningEmployeeId: "emp-b-dev",
        resourceType: "travel_request",
      };

      const crossTenantRead = authorize(managerCtx, PERMISSIONS.TRAVEL_REQUEST_READ_TEAM, crossTenantReq);
      expect(crossTenantRead.allowed).toBe(false);
      expect(crossTenantRead.reasonCode).toBe("TENANT_MISMATCH");

      const crossTenantFinance = authorize(financeCtx, PERMISSIONS.TRAVEL_APPROVE_FINANCE, crossTenantReq);
      expect(crossTenantFinance.allowed).toBe(false);
      expect(crossTenantFinance.reasonCode).toBe("TENANT_MISMATCH");
    });
  });
});
