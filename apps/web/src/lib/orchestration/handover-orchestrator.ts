import { randomUUID } from "node:crypto";
import { globalEventBus } from "@opsengine/domain-events";
import { globalAuditChainService } from "../audit";
import {
  HandoverLifecycleType,
  HandoverStatus,
  LifecycleHandoverContext,
  InitiateHandoverInput,
  RecordApprovalInput,
  HandoverExecutionResult,
  HandoverApproval,
} from "./types";

export class LifecycleOrchestrator {
  private handovers = new Map<string, LifecycleHandoverContext>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> handoverId

  /**
   * Resets orchestrator state (used primarily in tests).
   */
  public reset(tenantId?: string): void {
    if (tenantId) {
      for (const [id, ctx] of Array.from(this.handovers.entries())) {
        if (ctx.tenantId === tenantId) {
          if (ctx.idempotencyKey) {
            this.idempotencyIndex.delete(ctx.idempotencyKey);
          }
          this.handovers.delete(id);
        }
      }
    } else {
      this.handovers.clear();
      this.idempotencyIndex.clear();
    }
  }

  /**
   * Determines required approval roles based on lifecycle type and payload.
   */
  private determineRequiredApprovals(
    type: HandoverLifecycleType,
    payload: Record<string, unknown>
  ): string[] {
    switch (type) {
      case "LEAD_TO_PROJECT_CASH": {
        const amountCents = Number(payload.amountCents || 0);
        // Enterprise threshold: Deals >= $50,000 (5,000,000 cents) require dual approval
        if (amountCents >= 5000000) {
          return ["sales_lead", "finance_admin"];
        }
        return ["sales_lead"];
      }

      case "HIRE_TO_ONBOARD_PROBATION": {
        return ["hiring_manager", "hr_lead"];
      }

      case "PRODUCTION_CHANGE_APPROVAL": {
        const riskLevel = String(payload.riskLevel || "LOW").toUpperCase();
        if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
          return ["dev_lead", "qa_lead", "security_officer"];
        }
        if (riskLevel === "MEDIUM") {
          return ["dev_lead", "qa_lead"];
        }
        return ["dev_lead"];
      }

      default:
        return ["admin"];
    }
  }

  /**
   * Initiates a new lifecycle handover or returns existing if idempotent.
   */
  public async initiateHandover(
    tenantId: string,
    input: InitiateHandoverInput
  ): Promise<LifecycleHandoverContext> {
    if (!tenantId) {
      throw new Error("tenantId is required to initiate a handover");
    }
    if (!input.type || !input.sourceEntityId || !input.initiatorUserId) {
      throw new Error("type, sourceEntityId, and initiatorUserId are mandatory");
    }

    const idempotencyKey =
      input.idempotencyKey || `${tenantId}:${input.type}:${input.sourceEntityId}`;

    if (this.idempotencyIndex.has(idempotencyKey)) {
      const existingId = this.idempotencyIndex.get(idempotencyKey)!;
      return this.handovers.get(existingId)!;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const requiredApprovals = this.determineRequiredApprovals(input.type, input.payload);

    const context: LifecycleHandoverContext = {
      id,
      tenantId,
      type: input.type,
      status: requiredApprovals.length > 0 ? "PENDING_APPROVAL" : "VALIDATED",
      sourceEntityId: input.sourceEntityId,
      sourceEntityType: input.sourceEntityType,
      initiatorUserId: input.initiatorUserId,
      idempotencyKey,
      requiredApprovals,
      collectedApprovals: [],
      payload: input.payload,
      handoverArtifacts: {},
      createdAt: now,
      updatedAt: now,
    };

    this.handovers.set(id, context);
    this.idempotencyIndex.set(idempotencyKey, id);

    // Audit log
    const auditRecord = await globalAuditChainService.appendRecord(tenantId, {
      actorUserId: input.initiatorUserId,
      eventType: "LIFECYCLE_HANDOVER_INITIATED",
      resourceType: input.sourceEntityType,
      resourceId: input.sourceEntityId,
      decision: "allow",
      metadata: {
        handoverId: id,
        type: input.type,
        requiredApprovals,
      },
    });

    context.auditRecordHash = auditRecord.recordHash;

    // Publish domain event
    await globalEventBus.publish({
      id: randomUUID(),
      name: "lifecycle.handover.initiated.v1",
      tenantId,
      aggregateType: "lifecycle_handover",
      aggregateId: id,
      version: 1,
      correlationId: randomUUID(),
      payload: {
        handoverId: id,
        type: input.type,
        sourceEntityId: input.sourceEntityId,
      },
      timestamp: now,
    });

    return context;
  }

  /**
   * Records a stakeholder approval on an active handover.
   */
  public async recordApproval(
    tenantId: string,
    input: RecordApprovalInput
  ): Promise<LifecycleHandoverContext> {
    const context = this.handovers.get(input.handoverId);
    if (!context || context.tenantId !== tenantId) {
      throw new Error(`Handover not found for tenant: ${input.handoverId}`);
    }

    if (context.status !== "PENDING_APPROVAL" && context.status !== "VALIDATED") {
      throw new Error(`Cannot record approval in state: ${context.status}`);
    }

    if (!context.requiredApprovals.includes(input.role)) {
      throw new Error(`Role ${input.role} is not an authorized approver for this handover`);
    }

    const alreadyApproved = context.collectedApprovals.some((a) => a.role === input.role);
    if (alreadyApproved) {
      throw new Error(`Role ${input.role} has already recorded approval`);
    }

    const approval: HandoverApproval = {
      userId: input.userId,
      role: input.role,
      approvedAt: new Date().toISOString(),
      comments: input.comments,
    };

    context.collectedApprovals.push(approval);
    context.updatedAt = new Date().toISOString();

    // Check if quorum is fully satisfied
    const quorumSatisfied = context.requiredApprovals.every((role) =>
      context.collectedApprovals.some((a) => a.role === role)
    );

    if (quorumSatisfied) {
      context.status = "VALIDATED";
    }

    // Audit log
    await globalAuditChainService.appendRecord(tenantId, {
      actorUserId: input.userId,
      eventType: "LIFECYCLE_HANDOVER_APPROVED",
      resourceType: "lifecycle_handover",
      resourceId: context.id,
      decision: "allow",
      metadata: {
        role: input.role,
        quorumSatisfied,
        collectedCount: context.collectedApprovals.length,
      },
    });

    return context;
  }

  /**
   * Executes the handover pipeline once validated, creating downstream target resources.
   */
  public async executeHandover(
    tenantId: string,
    handoverId: string,
    executorUserId: string
  ): Promise<HandoverExecutionResult> {
    const context = this.handovers.get(handoverId);
    if (!context || context.tenantId !== tenantId) {
      throw new Error(`Handover not found for tenant: ${handoverId}`);
    }

    if (context.status === "COMPLETED") {
      return {
        success: true,
        handoverId,
        status: "COMPLETED",
        targetEntityId: context.targetEntityId,
        artifacts: context.handoverArtifacts,
      };
    }

    if (context.status !== "VALIDATED") {
      throw new Error(`Handover must be in VALIDATED state to execute; current status: ${context.status}`);
    }

    context.status = "EXECUTING";
    context.updatedAt = new Date().toISOString();

    try {
      let targetEntityId: string;
      let targetEntityType: string;
      const artifacts: Record<string, unknown> = {};

      switch (context.type) {
        case "LEAD_TO_PROJECT_CASH": {
          targetEntityType = "project";
          targetEntityId = randomUUID();
          const projectCode = `PRJ-${context.sourceEntityId.slice(0, 8).toUpperCase()}`;
          const budgetCents = Number(context.payload.amountCents || 0);

          artifacts.projectId = targetEntityId;
          artifacts.projectCode = projectCode;
          artifacts.projectTitle = context.payload.opportunityTitle || "Client Delivery Project";
          artifacts.budgetCents = budgetCents;
          artifacts.milestones = [
            { id: randomUUID(), name: "Project Kickoff & Architecture Alignment", status: "PENDING" },
            { id: randomUUID(), name: "Sprint Delivery & QA Verification", status: "PENDING" },
            { id: randomUUID(), name: "Client Acceptance & Final Handover", status: "PENDING" },
          ];

          // Generate draft milestone invoice schedule
          artifacts.invoices = [
            {
              invoiceId: randomUUID(),
              milestone: "Upfront Advance",
              percentage: 40,
              amountCents: Math.round(budgetCents * 0.4),
              status: "DRAFT",
            },
            {
              invoiceId: randomUUID(),
              milestone: "Final Acceptance",
              percentage: 60,
              amountCents: budgetCents - Math.round(budgetCents * 0.4),
              status: "SCHEDULED",
            },
          ];
          break;
        }

        case "HIRE_TO_ONBOARD_PROBATION": {
          targetEntityType = "employee";
          targetEntityId = randomUUID();
          const startDate = (context.payload.startDate as string) || new Date().toISOString().slice(0, 10);
          const startDateTime = new Date(startDate);
          const probationReviewDate = new Date(startDateTime.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

          artifacts.employeeId = targetEntityId;
          artifacts.employeeName = context.payload.candidateName || "New Employee";
          artifacts.jobTitle = context.payload.jobTitle || "Software Engineer";
          artifacts.department = context.payload.department || "Engineering";
          artifacts.status = "PENDING_START";
          artifacts.startDate = startDate;
          artifacts.probationReviewDate = probationReviewDate;

          artifacts.onboardingTasks = [
            { id: randomUUID(), task: "IT Hardware & Secure Credential Provisioning", completed: false },
            { id: randomUUID(), task: "HR Policy, NDA & Compliance Sign-Off", completed: false },
            { id: randomUUID(), task: "Manager Alignment & 30-60-90 Day Goals", completed: false },
          ];
          break;
        }

        case "PRODUCTION_CHANGE_APPROVAL": {
          targetEntityType = "deployment_ticket";
          targetEntityId = randomUUID();
          const releaseTag = (context.payload.releaseTag as string) || "v1.0.0";

          artifacts.ticketId = targetEntityId;
          artifacts.releaseTag = releaseTag;
          artifacts.releaseGatePass = true;
          artifacts.authorizedAt = new Date().toISOString();
          artifacts.authorizationToken = `GATE-SEAL-${randomUUID()}`;
          break;
        }
      }

      context.targetEntityId = targetEntityId;
      context.targetEntityType = targetEntityType;
      context.handoverArtifacts = artifacts;
      context.status = "COMPLETED";
      context.updatedAt = new Date().toISOString();

      // Emit domain event
      await globalEventBus.publish({
        id: randomUUID(),
        name: "lifecycle.handover.completed.v1",
        tenantId,
        aggregateType: context.type,
        aggregateId: context.id,
        version: 1,
        correlationId: randomUUID(),
        payload: {
          handoverId,
          targetEntityType,
          targetEntityId,
          executorUserId,
        },
        timestamp: new Date().toISOString(),
      });

      // Write cryptographic audit log
      await globalAuditChainService.appendRecord(tenantId, {
        actorUserId: executorUserId,
        eventType: "LIFECYCLE_HANDOVER_COMPLETED",
        resourceType: targetEntityType,
        resourceId: targetEntityId,
        decision: "allow",
        metadata: {
          handoverId,
          type: context.type,
          targetEntityType,
          targetEntityId,
        },
      });

      return {
        success: true,
        handoverId,
        status: "COMPLETED",
        targetEntityId,
        artifacts,
      };
    } catch (err: any) {
      context.status = "FAILED";
      context.updatedAt = new Date().toISOString();
      return {
        success: false,
        handoverId,
        status: "FAILED",
        error: err?.message || "Execution error",
      };
    }
  }

  /**
   * Retrieves a handover by ID.
   */
  public getHandover(tenantId: string, handoverId: string): LifecycleHandoverContext | null {
    const context = this.handovers.get(handoverId);
    if (!context || context.tenantId !== tenantId) {
      return null;
    }
    return context;
  }

  /**
   * Lists handovers for a tenant with optional status/type filtering.
   */
  public listHandovers(
    tenantId: string,
    options?: { status?: HandoverStatus; type?: HandoverLifecycleType }
  ): LifecycleHandoverContext[] {
    const list: LifecycleHandoverContext[] = [];
    for (const ctx of Array.from(this.handovers.values())) {
      if (ctx.tenantId !== tenantId) continue;
      if (options?.status && ctx.status !== options.status) continue;
      if (options?.type && ctx.type !== options.type) continue;
      list.push(ctx);
    }
    return list;
  }
}

// Global singleton pattern
declare global {
  var __OPSENGINE_LIFECYCLE_ORCHESTRATOR__: LifecycleOrchestrator | undefined;
}

export const globalLifecycleOrchestrator: LifecycleOrchestrator =
  globalThis.__OPSENGINE_LIFECYCLE_ORCHESTRATOR__ ?? new LifecycleOrchestrator();

if (process.env.NODE_ENV !== "production") {
  globalThis.__OPSENGINE_LIFECYCLE_ORCHESTRATOR__ = globalLifecycleOrchestrator;
}
