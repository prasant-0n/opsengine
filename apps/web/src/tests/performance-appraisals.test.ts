import { describe, it, expect } from "vitest";
import {
  APPRAISAL_CYCLE_STATUSES,
  APPRAISAL_REVIEW_TYPES,
  RECOMMENDATIONS,
  calculateCompositeAppraisalScore,
  calculateOkrProgress,
  canTransitionCycle,
  evaluateCalibrationDistribution,
  AppraisalCycleStatus,
  AppraisalReviewType,
} from "../features/appraisals/lib/appraisal-engine";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { scopeAllows, ResourceScope } from "../lib/permissions/scopes";
import { authorize } from "../lib/permissions/engine";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #41: Performance Appraisals & OKR 360-Degree Reviews", () => {
  describe("1. Domain Taxonomy & Status Validation", () => {
    it("recognizes all compliant appraisal cycle statuses", () => {
      const initial: AppraisalCycleStatus = "planning";
      expect(APPRAISAL_CYCLE_STATUSES).toContain(initial);
      expect(APPRAISAL_CYCLE_STATUSES).toContain("active");
      expect(APPRAISAL_CYCLE_STATUSES).toContain("calibration");
      expect(APPRAISAL_CYCLE_STATUSES).toContain("closed");
    });

    it("recognizes all 360-degree review types and recommendations", () => {
      const selfType: AppraisalReviewType = "self";
      expect(APPRAISAL_REVIEW_TYPES).toContain(selfType);
      expect(APPRAISAL_REVIEW_TYPES).toContain("manager");
      expect(APPRAISAL_REVIEW_TYPES).toContain("peer");
      expect(APPRAISAL_REVIEW_TYPES).toContain("upward");

      expect(RECOMMENDATIONS).toContain("promotion");
      expect(RECOMMENDATIONS).toContain("compensation_increase");
      expect(RECOMMENDATIONS).toContain("pip");
      expect(RECOMMENDATIONS).toContain("none");
    });
  });

  describe("2. OKR Progress Engine", () => {
    it("calculates aggregate progress percentage across multiple key results", () => {
      const keyResults = [
        { targetValue: 100, currentValue: 80 }, // 80%
        { targetValue: 50, currentValue: 50 },  // 100%
        { targetValue: 200, currentValue: 120 }, // 60%
      ];

      // Average: (80 + 100 + 60) / 3 = 240 / 3 = 80.0%
      const progress = calculateOkrProgress(keyResults);
      expect(progress).toBe(80.0);
    });

    it("caps key result achievement at 100% and handles zero targets gracefully", () => {
      const keyResults = [
        { targetValue: 100, currentValue: 150 }, // Overachieved -> 100%
        { targetValue: 0, currentValue: 0 },    // Zero target -> 0%
      ];

      const progress = calculateOkrProgress(keyResults);
      expect(progress).toBe(50.0);
    });

    it("returns 0% progress when no key results exist", () => {
      expect(calculateOkrProgress([])).toBe(0.0);
    });
  });

  describe("3. 360-Degree Composite Appraisal Scoring Engine", () => {
    it("computes weighted composite score combining manager, self, peer, and OKR achievement", () => {
      // Manager (50% weight): 4.5
      // Self (15% weight): 4.0
      // Peer (20% weight): 4.2
      // OKR Progress: 85% -> 1.0 + (0.85 * 4.0) = 4.4 (15% weight)
      const reviews = [
        { reviewType: "manager" as const, overallRating: 4.5 },
        { reviewType: "self" as const, overallRating: 4.0 },
        { reviewType: "peer" as const, overallRating: 4.2 },
      ];

      const result = calculateCompositeAppraisalScore(reviews, 85);

      // Expected calculation:
      // (4.5 * 0.5) + (4.0 * 0.15) + (4.2 * 0.20) + (4.4 * 0.15)
      // = 2.25 + 0.60 + 0.84 + 0.66 = 4.35 -> rounded to 4.4
      expect(result.finalScore).toBe(4.4);
      expect(result.performanceBand).toBe("Exceeds Expectations");
      expect(result.breakdown.managerScore).toBe(4.5);
      expect(result.breakdown.selfScore).toBe(4.0);
      expect(result.breakdown.peerScore).toBe(4.2);
    });

    it("accurately classifies exceptional performance in Band 5 (>= 4.5)", () => {
      const reviews = [
        { reviewType: "manager" as const, overallRating: 4.9 },
        { reviewType: "self" as const, overallRating: 4.8 },
        { reviewType: "peer" as const, overallRating: 4.7 },
      ];

      const result = calculateCompositeAppraisalScore(reviews, 95);
      expect(result.finalScore).toBeGreaterThanOrEqual(4.5);
      expect(result.performanceBand).toBe("Exceptional / Far Exceeds");
    });

    it("accurately classifies underperformance requiring PIP (< 2.0)", () => {
      const reviews = [
        { reviewType: "manager" as const, overallRating: 1.5 },
        { reviewType: "self" as const, overallRating: 2.0 },
        { reviewType: "peer" as const, overallRating: 1.5 },
      ];

      const result = calculateCompositeAppraisalScore(reviews, 20);
      expect(result.finalScore).toBeLessThan(2.0);
      expect(result.performanceBand).toBe("Unsatisfactory / Critical Gap");
    });
  });

  describe("4. Bell-Curve Rating Calibration & Distribution Matrix", () => {
    it("evaluates population distribution across the 5 corporate performance bands", () => {
      const scores = [
        4.8, // Band 5
        4.2, 4.0, 3.9, // Band 4 (3 scores)
        3.5, 3.4, 3.2, 3.0, 3.0, // Band 3 (5 scores)
        2.5, // Band 2 (1 score)
      ]; // Total 10 scores

      const distribution = evaluateCalibrationDistribution(scores);

      expect(distribution.count).toBe(10);
      expect(distribution.distribution.band5_exceptional).toBe(10); // 1/10 = 10%
      expect(distribution.distribution.band4_exceeds).toBe(30);     // 3/10 = 30%
      expect(distribution.distribution.band3_meets).toBe(50);       // 5/10 = 50%
      expect(distribution.distribution.band2_needs_improvement).toBe(10); // 1/10 = 10%
      expect(distribution.distribution.band1_unsatisfactory).toBe(0);
    });
  });

  describe("5. Cycle Lifecycle State Machine Transitions", () => {
    it("allows valid forward appraisal cycle progressions", () => {
      expect(canTransitionCycle("planning", "active")).toBe(true);
      expect(canTransitionCycle("active", "calibration")).toBe(true);
      expect(canTransitionCycle("calibration", "closed")).toBe(true);
    });

    it("strictly disallows skipping directly to closed or reopening closed cycles", () => {
      expect(canTransitionCycle("planning", "closed")).toBe(false);
      expect(canTransitionCycle("closed", "active")).toBe(false);
      expect(canTransitionCycle("closed", "planning")).toBe(false);
    });
  });

  describe("6. ReBAC Scoping & Segregation of Duties (SoD)", () => {
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
          key: PERMISSIONS.APPRAISAL_REVIEW_READ_SELF,
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

    it("allows employee to view their own appraisal reviews under SELF scope", () => {
      const resource: ResourceScope = {
        tenantId: tenantA,
        owningEmployeeId: employeeAlice,
      };

      const isAllowed = scopeAllows(aliceContext, "SELF", null, resource);
      expect(isAllowed).toBe(true);
    });

    it("denies employee from accessing another employee's appraisal reviews under SELF scope", () => {
      const resource: ResourceScope = {
        tenantId: tenantA,
        owningEmployeeId: employeeBob,
      };

      const isAllowed = scopeAllows(aliceContext, "SELF", null, resource);
      expect(isAllowed).toBe(false);
    });

    it("strictly isolates appraisal reviews across tenant boundaries", () => {
      const hrContext: AuthorizationContext = {
        tenantId: tenantA,
        userId: "user-hr",
        employeeId: employeeAlice,
        membershipStatus: "active",
        assurance: { mfa: false },
        permissions: [
          {
            key: PERMISSIONS.APPRAISAL_REVIEW_READ_TEAM,
            scopeType: "TENANT",
            scopeId: null,
            validTo: null,
          },
        ],
        roles: [{ key: "tenant_admin", scopeType: "TENANT", scopeId: null }],
        teamMemberships: [],
        reporting: { managerIds: [], reportIds: [] },
        accessGroupIds: [],
        policyVersion: 1,
        builtAt: Date.now(),
      };

      const decision = authorize(hrContext, PERMISSIONS.APPRAISAL_REVIEW_READ_TEAM, {
        tenantId: tenantB, // Cross-tenant negative boundary
        resourceType: "appraisal_review",
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("TENANT_MISMATCH");
    });
  });
});
