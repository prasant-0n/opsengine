export type HandoverLifecycleType =
  | "LEAD_TO_PROJECT_CASH"
  | "HIRE_TO_ONBOARD_PROBATION"
  | "PRODUCTION_CHANGE_APPROVAL";

export type HandoverStatus =
  | "INITIATED"
  | "VALIDATED"
  | "PENDING_APPROVAL"
  | "EXECUTING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export interface HandoverApproval {
  userId: string;
  role: string;
  approvedAt: string;
  comments?: string;
}

export interface LifecycleHandoverContext {
  id: string;
  tenantId: string;
  type: HandoverLifecycleType;
  status: HandoverStatus;
  sourceEntityId: string;
  sourceEntityType: string;
  targetEntityId?: string;
  targetEntityType?: string;
  initiatorUserId: string;
  idempotencyKey?: string;
  requiredApprovals: string[];
  collectedApprovals: HandoverApproval[];
  payload: Record<string, unknown>;
  handoverArtifacts: Record<string, unknown>;
  auditRecordHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateHandoverInput {
  type: HandoverLifecycleType;
  sourceEntityId: string;
  sourceEntityType: string;
  initiatorUserId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface RecordApprovalInput {
  handoverId: string;
  userId: string;
  role: string;
  comments?: string;
}

export interface HandoverExecutionResult {
  success: boolean;
  handoverId: string;
  status: HandoverStatus;
  targetEntityId?: string;
  artifacts?: Record<string, unknown>;
  error?: string;
}
