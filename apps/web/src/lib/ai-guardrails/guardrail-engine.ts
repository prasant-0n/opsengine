import { randomUUID } from "node:crypto";
import { InjectionScanner, DataRedactor } from "./scanner";
import { ToolRegistry } from "./tool-registry";
import {
  AiActionProposal,
  AiExecutionResponse,
  ProposalStatus,
  ToolExecutionContext,
} from "./types";
import { globalAuditChainService } from "../audit";

export class AiGuardrailEngine {
  private proposals = new Map<string, AiActionProposal>();

  /**
   * Resets internal proposal state (used for testing).
   */
  public reset(tenantId?: string): void {
    if (tenantId) {
      for (const [id, prop] of Array.from(this.proposals.entries())) {
        if (prop.tenantId === tenantId) {
          this.proposals.delete(id);
        }
      }
    } else {
      this.proposals.clear();
    }
  }

  /**
   * Executes a user prompt through anti-injection scans, authorization checks, and sandboxed tools.
   */
  public async executePrompt(
    tenantId: string,
    userId: string,
    userPermissions: string[],
    prompt: string,
    requestedTools?: Array<{ toolName: string; arguments: Record<string, unknown> }>
  ): Promise<AiExecutionResponse> {
    if (!tenantId || !userId) {
      throw new Error("tenantId and userId are required");
    }

    // 1. Anti-Prompt Injection Scan
    const scanResult = InjectionScanner.scan(prompt);
    if (scanResult.isMalicious) {
      // Audit security event
      await globalAuditChainService.appendRecord(tenantId, {
        actorUserId: userId,
        eventType: "AI_SECURITY_INJECTION_BLOCKED",
        decision: "deny",
        reasonCode: "PROMPT_INJECTION_DETECTED",
        metadata: { reason: scanResult.reason },
      });

      throw new Error(scanResult.reason || "Prompt rejected by AI security guardrails");
    }

    const toolCallsExecuted: Array<{ toolName: string; result: Record<string, unknown> }> = [];
    const pendingProposals: AiActionProposal[] = [];
    const citations: string[] = [];

    const context: ToolExecutionContext = {
      tenantId,
      userId,
      userPermissions,
    };

    // 2. Process Requested Tools with Strict Authorization
    if (requestedTools && requestedTools.length > 0) {
      for (const req of requestedTools) {
        const tool = ToolRegistry.getTool(req.toolName);
        if (!tool) {
          throw new Error(`Tool '${req.toolName}' is not registered in AI sandbox`);
        }

        // Strict Prohibited Autonomous Action Guard
        if (tool.isProhibitedAutonomousDecision) {
          await globalAuditChainService.appendRecord(tenantId, {
            actorUserId: userId,
            eventType: "AI_PROHIBITED_ACTION_BLOCKED",
            decision: "deny",
            reasonCode: "AUTONOMOUS_DECISION_FORBIDDEN",
            metadata: { toolName: req.toolName },
          });

          throw new Error(
            `Security Policy Violation: AI is strictly prohibited from autonomous action '${req.toolName}' (PRD Module 17)`
          );
        }

        // Pre-Execution ReBAC Authorization Check
        if (!userPermissions.includes(tool.requiredPermission)) {
          await globalAuditChainService.appendRecord(tenantId, {
            actorUserId: userId,
            eventType: "AI_TOOL_ACCESS_DENIED",
            decision: "deny",
            reasonCode: "INSUFFICIENT_PERMISSIONS",
            metadata: { toolName: req.toolName, requiredPermission: tool.requiredPermission },
          });

          throw new Error(
            `Access Denied: User lacks required permission '${tool.requiredPermission}' for tool '${req.toolName}'`
          );
        }

        // Human-in-the-Loop Interceptor for Consequential Mutations
        if (tool.requiresHumanConfirmation) {
          const proposalId = randomUUID();
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

          const proposal: AiActionProposal = {
            id: proposalId,
            tenantId,
            toolName: req.toolName,
            arguments: req.arguments,
            consequenceSummary: `Proposed mutation '${req.toolName}' with parameters: ${JSON.stringify(req.arguments)}`,
            requiredPermission: tool.requiredPermission,
            proposedByUserId: userId,
            status: "PENDING_HUMAN_CONFIRMATION",
            createdAt: now.toISOString(),
            expiresAt,
          };

          this.proposals.set(proposalId, proposal);
          pendingProposals.push(proposal);

          // Audit proposal
          await globalAuditChainService.appendRecord(tenantId, {
            actorUserId: userId,
            eventType: "AI_MUTATION_PROPOSED",
            resourceType: "ai_proposal",
            resourceId: proposalId,
            decision: "allow",
            metadata: { toolName: req.toolName, proposalId },
          });
        } else {
          // Read-Only Safe Execution
          const rawResult = await tool.execute(context, req.arguments);

          // Redact PII and sensitive tokens from result
          const sanitizedString = DataRedactor.redact(JSON.stringify(rawResult));
          const sanitizedResult = JSON.parse(sanitizedString);

          toolCallsExecuted.push({
            toolName: req.toolName,
            result: sanitizedResult,
          });

          citations.push(`source://${tool.category.toLowerCase()}/${req.toolName}`);

          // Audit read query
          await globalAuditChainService.appendRecord(tenantId, {
            actorUserId: userId,
            eventType: "AI_TOOL_READ_EXECUTED",
            resourceType: tool.category.toLowerCase(),
            decision: "allow",
            metadata: { toolName: req.toolName },
          });
        }
      }
    }

    // Synthesize sanitized response
    let content = `I have processed your query: "${prompt}".`;
    if (toolCallsExecuted.length > 0) {
      content += ` Retrieved data from ${toolCallsExecuted.length} authorized source(s).`;
    }
    if (pendingProposals.length > 0) {
      content += ` Notice: ${pendingProposals.length} consequential action(s) require human confirmation before execution.`;
    }

    content = DataRedactor.redact(content);

    return {
      success: true,
      content,
      toolCallsExecuted,
      pendingProposals,
      citations,
    };
  }

  /**
   * Human-in-the-Loop confirmation: executes the proposed action once confirmed by an authorized human.
   */
  public async confirmProposal(
    tenantId: string,
    userId: string,
    userPermissions: string[],
    proposalId: string
  ): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.tenantId !== tenantId) {
      throw new Error(`Proposal not found for tenant: ${proposalId}`);
    }

    if (proposal.status !== "PENDING_HUMAN_CONFIRMATION") {
      throw new Error(`Cannot confirm proposal in state: ${proposal.status}`);
    }

    if (Date.now() > new Date(proposal.expiresAt).getTime()) {
      proposal.status = "EXPIRED";
      throw new Error("Action proposal has expired (15-minute TTL exceeded)");
    }

    // Binding Rule: AI cannot approve its own proposal
    if (userId === "ai-assistant" || userId === "system-ai") {
      throw new Error("Security Policy Violation: AI is strictly forbidden from approving its own actions");
    }

    // Authorization verification on confirming human
    if (!userPermissions.includes(proposal.requiredPermission)) {
      throw new Error(`Access Denied: Confirming user lacks permission '${proposal.requiredPermission}'`);
    }

    const tool = ToolRegistry.getTool(proposal.toolName);
    if (!tool) {
      throw new Error(`Tool '${proposal.toolName}' no longer available in registry`);
    }

    const context: ToolExecutionContext = {
      tenantId,
      userId,
      userPermissions,
    };

    const executionResult = await tool.execute(context, proposal.arguments);

    proposal.status = "CONFIRMED";
    proposal.confirmedByUserId = userId;
    proposal.confirmedAt = new Date().toISOString();
    proposal.executionResult = executionResult;

    // Cryptographic audit log
    await globalAuditChainService.appendRecord(tenantId, {
      actorUserId: userId,
      eventType: "AI_PROPOSAL_CONFIRMED_AND_EXECUTED",
      resourceType: "ai_proposal",
      resourceId: proposal.id,
      decision: "allow",
      metadata: {
        toolName: proposal.toolName,
        confirmedByUserId: userId,
      },
    });

    return {
      success: true,
      result: executionResult,
    };
  }

  /**
   * Rejects an action proposal.
   */
  public async rejectProposal(
    tenantId: string,
    userId: string,
    proposalId: string,
    reason?: string
  ): Promise<{ success: boolean }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.tenantId !== tenantId) {
      throw new Error(`Proposal not found for tenant: ${proposalId}`);
    }

    proposal.status = "REJECTED";
    proposal.rejectionReason = reason || "Rejected by user";

    await globalAuditChainService.appendRecord(tenantId, {
      actorUserId: userId,
      eventType: "AI_PROPOSAL_REJECTED",
      resourceType: "ai_proposal",
      resourceId: proposal.id,
      decision: "deny",
      reasonCode: "HUMAN_REJECTION",
      metadata: { reason },
    });

    return { success: true };
  }

  /**
   * Retrieves proposal details scoped to tenant.
   */
  public getProposal(tenantId: string, proposalId: string): AiActionProposal | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.tenantId !== tenantId) {
      return null;
    }
    return proposal;
  }

  /**
   * Lists proposals scoped to tenant.
   */
  public listProposals(tenantId: string, status?: ProposalStatus): AiActionProposal[] {
    const list: AiActionProposal[] = [];
    for (const prop of Array.from(this.proposals.values())) {
      if (prop.tenantId !== tenantId) continue;
      if (status && prop.status !== status) continue;
      list.push(prop);
    }
    return list;
  }
}

// Global singleton
declare global {
  var __OPSENGINE_AI_GUARDRAIL_ENGINE__: AiGuardrailEngine | undefined;
}

export const globalAiGuardrailEngine: AiGuardrailEngine =
  globalThis.__OPSENGINE_AI_GUARDRAIL_ENGINE__ ?? new AiGuardrailEngine();

if (process.env.NODE_ENV !== "production") {
  globalThis.__OPSENGINE_AI_GUARDRAIL_ENGINE__ = globalAiGuardrailEngine;
}
