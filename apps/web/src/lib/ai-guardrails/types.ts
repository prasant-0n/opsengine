export type ToolType = "READ_ONLY" | "MUTATING";

export interface ToolExecutionContext {
  tenantId: string;
  userId: string;
  userPermissions: string[];
}

export interface AiToolDefinition {
  name: string;
  description: string;
  category: "CRM" | "HR" | "PROJECT" | "FINANCE" | "SYSTEM";
  type: ToolType;
  requiredPermission: string;
  requiresHumanConfirmation: boolean;
  isProhibitedAutonomousDecision?: boolean;
  execute: (context: ToolExecutionContext, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export type ProposalStatus = "PENDING_HUMAN_CONFIRMATION" | "CONFIRMED" | "REJECTED" | "EXPIRED";

export interface AiActionProposal {
  id: string;
  tenantId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  consequenceSummary: string;
  requiredPermission: string;
  proposedByUserId: string;
  status: ProposalStatus;
  confirmedByUserId?: string;
  confirmedAt?: string;
  rejectionReason?: string;
  executionResult?: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

export interface AiExecutionResponse {
  success: boolean;
  content: string;
  toolCallsExecuted?: Array<{ toolName: string; result: Record<string, unknown> }>;
  pendingProposals?: AiActionProposal[];
  citations?: string[];
  warning?: string;
}
