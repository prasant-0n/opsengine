import { AiToolDefinition } from "./types";

export class ToolRegistry {
  private static tools = new Map<string, AiToolDefinition>();

  public static registerTool(tool: AiToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  public static getTool(name: string): AiToolDefinition | undefined {
    return this.tools.get(name);
  }

  public static listTools(userPermissions?: string[]): AiToolDefinition[] {
    const all = Array.from(this.tools.values()).filter(
      (t) => !t.isProhibitedAutonomousDecision
    );
    if (!userPermissions) {
      return all;
    }
    return all.filter((t) => userPermissions.includes(t.requiredPermission));
  }
}

// Register default enterprise tools
ToolRegistry.registerTool({
  name: "get_project_summary",
  description: "Retrieves status, timeline, and risk metrics for an active project",
  category: "PROJECT",
  type: "READ_ONLY",
  requiredPermission: "project.read",
  requiresHumanConfirmation: false,
  execute: async (ctx, args) => {
    return {
      projectId: args.projectId || "prj-default",
      tenantId: ctx.tenantId,
      status: "ACTIVE",
      milestonesCompleted: 2,
      totalMilestones: 4,
      health: "ON_TRACK",
    };
  },
});

ToolRegistry.registerTool({
  name: "get_ticket_status",
  description: "Queries support ticket queue, severity breakdown, and SLA metrics",
  category: "PROJECT",
  type: "READ_ONLY",
  requiredPermission: "tickets.read",
  requiresHumanConfirmation: false,
  execute: async (ctx, args) => {
    return {
      ticketId: args.ticketId || "tkt-001",
      tenantId: ctx.tenantId,
      status: "IN_PROGRESS",
      priority: "HIGH",
      slaDueHours: 4.5,
    };
  },
});

ToolRegistry.registerTool({
  name: "summarize_opportunity",
  description: "Summarizes CRM deal status, commercial proposal terms, and next steps",
  category: "CRM",
  type: "READ_ONLY",
  requiredPermission: "crm.read",
  requiresHumanConfirmation: false,
  execute: async (ctx, args) => {
    return {
      opportunityId: args.opportunityId || "opp-001",
      tenantId: ctx.tenantId,
      stage: "PROPOSAL_SHARED",
      amountCents: 4500000,
      clientContact: "director@client.internal",
    };
  },
});

ToolRegistry.registerTool({
  name: "draft_daily_report",
  description: "Prepares employee daily activity report (DAR) for review before submission",
  category: "HR",
  type: "MUTATING",
  requiredPermission: "worklogs.create",
  requiresHumanConfirmation: true,
  execute: async (ctx, args) => {
    return {
      darId: "dar-" + Date.now(),
      tenantId: ctx.tenantId,
      authorUserId: ctx.userId,
      summary: args.summary || "Drafted daily activities",
      hoursLogged: Number(args.hours || 8),
      status: "SUBMITTED",
    };
  },
});

ToolRegistry.registerTool({
  name: "create_support_ticket",
  description: "Creates a new operational support or defect ticket",
  category: "PROJECT",
  type: "MUTATING",
  requiredPermission: "tickets.create",
  requiresHumanConfirmation: true,
  execute: async (ctx, args) => {
    return {
      ticketId: "tkt-" + Date.now(),
      tenantId: ctx.tenantId,
      title: args.title || "Support Request",
      severity: args.severity || "MEDIUM",
      status: "OPEN",
    };
  },
});

// Prohibited autonomous actions (Strict PRD Module 17 guard)
ToolRegistry.registerTool({
  name: "approve_workflow_or_invoice",
  description: "AUTONOMOUS APPROVAL IS PROHIBITED",
  category: "FINANCE",
  type: "MUTATING",
  requiredPermission: "finance.approve",
  requiresHumanConfirmation: true,
  isProhibitedAutonomousDecision: true,
  execute: async () => {
    throw new Error("AI is strictly prohibited from autonomous workflow approvals (PRD Module 17)");
  },
});

ToolRegistry.registerTool({
  name: "terminate_employee_contract",
  description: "AUTONOMOUS HR TERMINATION IS PROHIBITED",
  category: "HR",
  type: "MUTATING",
  requiredPermission: "hrms.manage",
  requiresHumanConfirmation: true,
  isProhibitedAutonomousDecision: true,
  execute: async () => {
    throw new Error("AI is strictly prohibited from autonomous employment termination decisions (PRD Module 17)");
  },
});
