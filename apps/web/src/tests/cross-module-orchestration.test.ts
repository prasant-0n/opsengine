import { describe, it, expect, beforeEach } from "vitest";
import { LifecycleOrchestrator } from "../lib/orchestration";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const USER_SALES = "00000000-0000-4000-8000-000000000001";
const USER_FINANCE = "00000000-0000-4000-8000-000000000002";
const USER_DEV_LEAD = "00000000-0000-4000-8000-000000000003";
const USER_QA_LEAD = "00000000-0000-4000-8000-000000000004";
const USER_SEC_LEAD = "00000000-0000-4000-8000-000000000005";

describe("Feature #34 — Cross-Module Handover Engine & Multi-Service Lifecycle Orchestrator", () => {
  let orchestrator: LifecycleOrchestrator;

  beforeEach(() => {
    orchestrator = new LifecycleOrchestrator();
  });

  describe("Pipeline 1: Lead-to-Project-to-Cash (PRD §6.1)", () => {
    it("handles standard deal (<$50k) requiring single sales_lead approval", async () => {
      const opportunityId = "opp-standard-101";

      const handover = await orchestrator.initiateHandover(TENANT_A, {
        type: "LEAD_TO_PROJECT_CASH",
        sourceEntityId: opportunityId,
        sourceEntityType: "crmOpportunity",
        initiatorUserId: USER_SALES,
        payload: {
          opportunityTitle: "ERP Migration Phase 1",
          amountCents: 3500000, // $35,000
          clientName: "Acme Industrial Corp",
        },
      });

      expect(handover.status).toBe("PENDING_APPROVAL");
      expect(handover.requiredApprovals).toEqual(["sales_lead"]);

      // Record approval
      const approved = await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: USER_SALES,
        role: "sales_lead",
        comments: "Commercial terms verified with client",
      });

      expect(approved.status).toBe("VALIDATED");

      // Execute handover
      const execResult = await orchestrator.executeHandover(TENANT_A, handover.id, USER_SALES);

      expect(execResult.success).toBe(true);
      expect(execResult.status).toBe("COMPLETED");
      expect(execResult.targetEntityId).toBeDefined();

      const artifacts = execResult.artifacts as any;
      expect(artifacts.projectCode).toBeDefined();
      expect(artifacts.milestones).toHaveLength(3);
      expect(artifacts.invoices).toHaveLength(2);
      expect(artifacts.invoices[0].amountCents).toBe(1400000); // 40%
      expect(artifacts.invoices[1].amountCents).toBe(2100000); // 60%
    });

    it("enforces dual quorum (sales_lead + finance_admin) for large enterprise deals (>= $50k)", async () => {
      const opportunityId = "opp-enterprise-202";

      const handover = await orchestrator.initiateHandover(TENANT_A, {
        type: "LEAD_TO_PROJECT_CASH",
        sourceEntityId: opportunityId,
        sourceEntityType: "crmOpportunity",
        initiatorUserId: USER_SALES,
        payload: {
          opportunityTitle: "Global Cloud Transformation",
          amountCents: 15000000, // $150,000
        },
      });

      expect(handover.requiredApprovals).toEqual(["sales_lead", "finance_admin"]);

      // Sales Lead signs off
      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: USER_SALES,
        role: "sales_lead",
      });

      const partialCtx = orchestrator.getHandover(TENANT_A, handover.id);
      expect(partialCtx?.status).toBe("PENDING_APPROVAL");

      // Attempting execution prior to finance approval must be rejected
      await expect(
        orchestrator.executeHandover(TENANT_A, handover.id, USER_SALES)
      ).rejects.toThrow("Handover must be in VALIDATED state to execute");

      // Finance Admin signs off
      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: USER_FINANCE,
        role: "finance_admin",
        comments: "Credit check passed and payment schedule approved",
      });

      const fullCtx = orchestrator.getHandover(TENANT_A, handover.id);
      expect(fullCtx?.status).toBe("VALIDATED");

      // Execution succeeds
      const result = await orchestrator.executeHandover(TENANT_A, handover.id, USER_FINANCE);
      expect(result.status).toBe("COMPLETED");
    });
  });

  describe("Pipeline 2: Hire-to-Onboard-to-Probation (PRD §6.2)", () => {
    it("provisions employee record, onboarding checklist and schedules 90-day probation review", async () => {
      const offerId = "offer-cand-404";

      const handover = await orchestrator.initiateHandover(TENANT_A, {
        type: "HIRE_TO_ONBOARD_PROBATION",
        sourceEntityId: offerId,
        sourceEntityType: "candidateOffer",
        initiatorUserId: "usr-recruiter",
        payload: {
          candidateName: "Jane Doe",
          jobTitle: "Senior Staff Architect",
          department: "Core Platform",
          startDate: "2026-12-01",
        },
      });

      expect(handover.requiredApprovals).toEqual(["hiring_manager", "hr_lead"]);

      // Hiring manager approval
      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: "usr-hiring-mgr",
        role: "hiring_manager",
      });

      // HR lead approval
      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: "usr-hr-lead",
        role: "hr_lead",
      });

      const execResult = await orchestrator.executeHandover(TENANT_A, handover.id, "usr-hr-lead");
      expect(execResult.status).toBe("COMPLETED");

      const artifacts = execResult.artifacts as any;
      expect(artifacts.employeeName).toBe("Jane Doe");
      expect(artifacts.status).toBe("PENDING_START");
      expect(artifacts.startDate).toBe("2026-12-01");
      expect(artifacts.probationReviewDate).toBe("2027-03-01"); // exactly 90 days
      expect(artifacts.onboardingTasks).toHaveLength(3);
    });
  });

  describe("Pipeline 3: Production & Change Approval Gate (PRD §6.4)", () => {
    it("enforces multi-role quorum for HIGH risk changes (dev_lead + qa_lead + security_officer)", async () => {
      const releaseId = "rel-v2.5.0-rc1";

      const handover = await orchestrator.initiateHandover(TENANT_A, {
        type: "PRODUCTION_CHANGE_APPROVAL",
        sourceEntityId: releaseId,
        sourceEntityType: "releaseCandidate",
        initiatorUserId: USER_DEV_LEAD,
        payload: {
          releaseTag: "v2.5.0",
          riskLevel: "HIGH",
          summary: "Core Payment Engine & Database Sharding Migration",
        },
      });

      expect(handover.requiredApprovals).toEqual(["dev_lead", "qa_lead", "security_officer"]);

      // Dev lead approval
      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: USER_DEV_LEAD,
        role: "dev_lead",
      });

      // QA lead approval
      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: USER_QA_LEAD,
        role: "qa_lead",
      });

      expect(orchestrator.getHandover(TENANT_A, handover.id)?.status).toBe("PENDING_APPROVAL");

      // Security officer approval
      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: USER_SEC_LEAD,
        role: "security_officer",
      });

      expect(orchestrator.getHandover(TENANT_A, handover.id)?.status).toBe("VALIDATED");

      // Execute release gate seal
      const execResult = await orchestrator.executeHandover(TENANT_A, handover.id, USER_DEV_LEAD);
      expect(execResult.status).toBe("COMPLETED");

      const artifacts = execResult.artifacts as any;
      expect(artifacts.releaseGatePass).toBe(true);
      expect(artifacts.authorizationToken).toContain("GATE-SEAL-");
    });
  });

  describe("Idempotency & Replay Protection", () => {
    it("returns existing handover when duplicate initiation occurs", async () => {
      const sourceId = "opp-idem-123";

      const h1 = await orchestrator.initiateHandover(TENANT_A, {
        type: "LEAD_TO_PROJECT_CASH",
        sourceEntityId: sourceId,
        sourceEntityType: "crmOpportunity",
        initiatorUserId: USER_SALES,
        payload: { amountCents: 1000000 },
      });

      const h2 = await orchestrator.initiateHandover(TENANT_A, {
        type: "LEAD_TO_PROJECT_CASH",
        sourceEntityId: sourceId,
        sourceEntityType: "crmOpportunity",
        initiatorUserId: USER_SALES,
        payload: { amountCents: 1000000 },
      });

      expect(h1.id).toBe(h2.id);
      expect(orchestrator.listHandovers(TENANT_A)).toHaveLength(1);
    });

    it("idempotently handles execution of already completed handover", async () => {
      const handover = await orchestrator.initiateHandover(TENANT_A, {
        type: "PRODUCTION_CHANGE_APPROVAL",
        sourceEntityId: "rel-low-1",
        sourceEntityType: "release",
        initiatorUserId: USER_DEV_LEAD,
        payload: { riskLevel: "LOW" },
      });

      await orchestrator.recordApproval(TENANT_A, {
        handoverId: handover.id,
        userId: USER_DEV_LEAD,
        role: "dev_lead",
      });

      const firstExec = await orchestrator.executeHandover(TENANT_A, handover.id, USER_DEV_LEAD);
      expect(firstExec.status).toBe("COMPLETED");

      // Second execution returns same completed result without error
      const secondExec = await orchestrator.executeHandover(TENANT_A, handover.id, USER_DEV_LEAD);
      expect(secondExec.status).toBe("COMPLETED");
      expect(secondExec.targetEntityId).toBe(firstExec.targetEntityId);
    });
  });

  describe("Cross-Tenant Negative Security Boundaries", () => {
    it("strictly isolates handovers between Tenant A and Tenant B", async () => {
      const handoverA = await orchestrator.initiateHandover(TENANT_A, {
        type: "LEAD_TO_PROJECT_CASH",
        sourceEntityId: "opp-tenant-a",
        sourceEntityType: "crmOpportunity",
        initiatorUserId: USER_SALES,
        payload: { amountCents: 2000000 },
      });

      // Tenant B query by ID returns null
      expect(orchestrator.getHandover(TENANT_B, handoverA.id)).toBeNull();

      // Tenant B list returns 0 handovers
      expect(orchestrator.listHandovers(TENANT_B)).toHaveLength(0);

      // Tenant B cannot approve Tenant A's handover
      await expect(
        orchestrator.recordApproval(TENANT_B, {
          handoverId: handoverA.id,
          userId: "usr-tenant-b",
          role: "sales_lead",
        })
      ).rejects.toThrow("Handover not found for tenant");

      // Tenant B cannot execute Tenant A's handover
      await expect(
        orchestrator.executeHandover(TENANT_B, handoverA.id, "usr-tenant-b")
      ).rejects.toThrow("Handover not found for tenant");
    });
  });
});
