import { describe, it, expect } from "vitest";
import {
  calculateEnpsScore,
  aggregateSurveyAnalytics,
  aggregateEmployeeRewardPoints,
  SurveyQuestion,
  EmployeeRecognitionRecord,
} from "../features/surveys-recognition/lib/surveys-engine";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { authorize } from "../lib/permissions/engine";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #45 — Formal Surveys, Employee Pulse & Peer Recognition Rewards", () => {
  describe("Domain Engine: Employee Net Promoter Score (eNPS)", () => {
    it("returns zero score and zero distribution when scores array is empty", () => {
      const summary = calculateEnpsScore([]);
      expect(summary.enpsScore).toBe(0);
      expect(summary.totalResponses).toBe(0);
      expect(summary.promotersCount).toBe(0);
      expect(summary.detractorsCount).toBe(0);
      expect(summary.passivesCount).toBe(0);
    });

    it("evaluates a unanimous promoter cohort as +100 eNPS", () => {
      const summary = calculateEnpsScore([9, 10, 10, 9, 10]);
      expect(summary.enpsScore).toBe(100);
      expect(summary.totalResponses).toBe(5);
      expect(summary.promotersPct).toBe(100);
      expect(summary.detractorsPct).toBe(0);
      expect(summary.passivesPct).toBe(0);
    });

    it("evaluates a unanimous detractor cohort as -100 eNPS", () => {
      const summary = calculateEnpsScore([0, 2, 4, 5, 6]);
      expect(summary.enpsScore).toBe(-100);
      expect(summary.totalResponses).toBe(5);
      expect(summary.detractorsPct).toBe(100);
      expect(summary.promotersPct).toBe(0);
    });

    it("evaluates a passive cohort (7-8) as 0 eNPS", () => {
      const summary = calculateEnpsScore([7, 8, 7, 8, 8]);
      expect(summary.enpsScore).toBe(0);
      expect(summary.passivesPct).toBe(100);
      expect(summary.promotersPct).toBe(0);
      expect(summary.detractorsPct).toBe(0);
    });

    it("calculates mixed enterprise distribution accurately (% Promoters - % Detractors)", () => {
      // 10 responses: 6 Promoters (9,10), 2 Passives (7,8), 2 Detractors (3,5)
      // Promoters: 60%, Detractors: 20% -> eNPS = +40
      const scores = [10, 9, 10, 9, 9, 10, 7, 8, 3, 5];
      const summary = calculateEnpsScore(scores);

      expect(summary.totalResponses).toBe(10);
      expect(summary.promotersCount).toBe(6);
      expect(summary.passivesCount).toBe(2);
      expect(summary.detractorsCount).toBe(2);
      expect(summary.promotersPct).toBe(60);
      expect(summary.detractorsPct).toBe(20);
      expect(summary.passivesPct).toBe(20);
      expect(summary.enpsScore).toBe(40);
    });

    it("disregards out-of-range or invalid score values safely", () => {
      const summary = calculateEnpsScore([10, -5, 15, NaN as any, 9, 7]);
      // Valid scores are 10, 9, 7 (2 promoters, 1 passive, 0 detractors = total 3)
      // Promoters = 67%, Detractors = 0% -> eNPS = +67
      expect(summary.totalResponses).toBe(3);
      expect(summary.promotersCount).toBe(2);
      expect(summary.passivesCount).toBe(1);
      expect(summary.enpsScore).toBe(67);
    });
  });

  describe("Domain Engine: Survey Question Analytics Aggregator", () => {
    const sampleQuestions: SurveyQuestion[] = [
      {
        id: "q-nps",
        type: "nps_10",
        prompt: "How likely are you to recommend our company?",
      },
      {
        id: "q-likert",
        type: "likert_5",
        prompt: "I have the tooling and autonomy needed to succeed.",
      },
      {
        id: "q-choice",
        type: "choice",
        prompt: "Preferred team meeting frequency?",
        options: ["Daily", "Bi-weekly", "Weekly"],
      },
      {
        id: "q-text",
        type: "text",
        prompt: "Any additional suggestions?",
      },
    ];

    it("computes Likert average score and choice distributions across submissions", () => {
      const responses = [
        {
          answers: [
            { questionId: "q-nps", score: 10 },
            { questionId: "q-likert", score: 5 },
            { questionId: "q-choice", selectedOption: "Weekly" },
            { questionId: "q-text", textAnswer: "Great collaboration tooling!" },
          ],
          npsScore: 10,
        },
        {
          answers: [
            { questionId: "q-nps", score: 9 },
            { questionId: "q-likert", score: 4 },
            { questionId: "q-choice", selectedOption: "Weekly" },
          ],
          npsScore: 9,
        },
        {
          answers: [
            { questionId: "q-nps", score: 8 },
            { questionId: "q-likert", score: 3 },
            { questionId: "q-choice", selectedOption: "Daily" },
          ],
          npsScore: 8,
        },
      ];

      const result = aggregateSurveyAnalytics(
        { id: "survey-001", questions: sampleQuestions },
        responses
      );

      expect(result.totalSubmissions).toBe(3);
      expect(result.overallEnps?.enpsScore).toBe(67); // 2 promoters, 1 passive = 67%

      const likertQA = result.questionsAnalytics.find((q) => q.questionId === "q-likert");
      expect(likertQA).toBeDefined();
      expect(likertQA?.likertAverage).toBe(4.0); // (5 + 4 + 3) / 3 = 4.0
      expect(likertQA?.likertDistribution?.[5]).toBe(1);
      expect(likertQA?.likertDistribution?.[4]).toBe(1);
      expect(likertQA?.likertDistribution?.[3]).toBe(1);

      const choiceQA = result.questionsAnalytics.find((q) => q.questionId === "q-choice");
      expect(choiceQA?.choiceDistribution?.["Weekly"]).toBe(2);
      expect(choiceQA?.choiceDistribution?.["Daily"]).toBe(1);

      const textQA = result.questionsAnalytics.find((q) => q.questionId === "q-text");
      expect(textQA?.textResponses).toContain("Great collaboration tooling!");
    });
  });

  describe("Domain Engine: Peer Recognition Points & Badge Accumulation", () => {
    it("aggregates total points and counts distinct badges awarded to an employee", () => {
      const records: EmployeeRecognitionRecord[] = [
        {
          id: "rec-1",
          senderId: "emp-lead1",
          recipientId: "emp-dev1",
          badgeId: "badge-tech",
          pointsAwarded: 50,
          createdAt: new Date(),
        },
        {
          id: "rec-2",
          senderId: "emp-lead2",
          recipientId: "emp-dev1",
          badgeId: "badge-tech",
          pointsAwarded: 50,
          createdAt: new Date(),
        },
        {
          id: "rec-3",
          senderId: "emp-qa",
          recipientId: "emp-dev1",
          badgeId: "badge-team",
          pointsAwarded: 75,
          createdAt: new Date(),
        },
        {
          id: "rec-4",
          senderId: "emp-lead1",
          recipientId: "emp-dev2", // Another employee -> should not affect emp-dev1
          badgeId: "badge-tech",
          pointsAwarded: 50,
          createdAt: new Date(),
        },
      ];

      const summary = aggregateEmployeeRewardPoints("emp-dev1", records);
      expect(summary.recipientId).toBe("emp-dev1");
      expect(summary.totalPoints).toBe(175);
      expect(summary.totalRecognitionsReceived).toBe(3);
      expect(summary.badgeCounts["badge-tech"]).toBe(2);
      expect(summary.badgeCounts["badge-team"]).toBe(1);
    });
  });

  describe("ReBAC Permissions & Strict Cross-Tenant Security", () => {
    const tenantA = "00000000-0000-4000-8000-0000000000aa";
    const tenantB = "00000000-0000-4000-8000-0000000000bb";

    const employeeCtx: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-dev1",
      employeeId: "emp-dev1",
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        { key: PERMISSIONS.SURVEY_RESPOND, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.RECOGNITION_GIVE, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.RECOGNITION_READ, scopeType: "TENANT", scopeId: null, validTo: null },
      ],
      roles: [{ key: "employee", scopeType: "SELF", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    const hrLeadCtx: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-hr1",
      employeeId: "emp-hr1",
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        { key: PERMISSIONS.SURVEY_MANAGE, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.SURVEY_RESPOND, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.SURVEY_ANALYTICS_READ, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.RECOGNITION_GIVE, scopeType: "TENANT", scopeId: null, validTo: null },
        { key: PERMISSIONS.RECOGNITION_READ, scopeType: "TENANT", scopeId: null, validTo: null },
      ],
      roles: [{ key: "hr", scopeType: "TENANT", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows HR lead to manage surveys, but denies regular employee", () => {
      const resourceA = {
        tenantId: tenantA,
        owningEmployeeId: "emp-hr1",
        resourceType: "survey",
      };

      const hrDecision = authorize(hrLeadCtx, PERMISSIONS.SURVEY_MANAGE, resourceA);
      expect(hrDecision.allowed).toBe(true);

      const empDecision = authorize(employeeCtx, PERMISSIONS.SURVEY_MANAGE, resourceA);
      expect(empDecision.allowed).toBe(false);
    });

    it("allows HR lead to view survey analytics, but denies regular employee", () => {
      const resourceA = {
        tenantId: tenantA,
        owningEmployeeId: "emp-hr1",
        resourceType: "survey",
      };

      const hrAnalytics = authorize(hrLeadCtx, PERMISSIONS.SURVEY_ANALYTICS_READ, resourceA);
      expect(hrAnalytics.allowed).toBe(true);

      const empAnalytics = authorize(employeeCtx, PERMISSIONS.SURVEY_ANALYTICS_READ, resourceA);
      expect(empAnalytics.allowed).toBe(false);
    });

    it("allows active employee to respond to tenant surveys and give recognition", () => {
      const resourceA = {
        tenantId: tenantA,
        owningEmployeeId: "emp-dev1",
        resourceType: "survey",
      };

      const respondDecision = authorize(employeeCtx, PERMISSIONS.SURVEY_RESPOND, resourceA);
      expect(respondDecision.allowed).toBe(true);

      const giveDecision = authorize(employeeCtx, PERMISSIONS.RECOGNITION_GIVE, resourceA);
      expect(giveDecision.allowed).toBe(true);
    });

    it("strictly isolates surveys across tenant boundaries", () => {
      const tenantBResource = {
        tenantId: tenantB,
        owningEmployeeId: "emp-b-hr",
        resourceType: "survey",
      };

      const crossTenantManage = authorize(
        hrLeadCtx,
        PERMISSIONS.SURVEY_MANAGE,
        tenantBResource
      );
      expect(crossTenantManage.allowed).toBe(false);
      expect(crossTenantManage.reasonCode).toBe("TENANT_MISMATCH");

      const crossTenantRespond = authorize(
        employeeCtx,
        PERMISSIONS.SURVEY_RESPOND,
        tenantBResource
      );
      expect(crossTenantRespond.allowed).toBe(false);
      expect(crossTenantRespond.reasonCode).toBe("TENANT_MISMATCH");
    });
  });
});
