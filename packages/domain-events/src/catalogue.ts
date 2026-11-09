/**
 * Domain Events Catalogue & Factory Helpers
 * Conforms directly to PRD §11 (Domain Events and Integration Contracts)
 */

import { DomainEvent } from "./types";
import { randomUUID } from "node:crypto";

export const DomainEventNames = {
  // Tenant & SaaS Control Plane (PRD Module 0A)
  TENANT_PROVISIONED: "tenant.provisioned.v1",
  TENANT_LIFECYCLE_CHANGED: "tenant.lifecycle.changed.v1",
  TENANT_SUBSCRIPTION_CHANGED: "tenant.subscription.changed.v1",
  TENANT_ENTITLEMENT_CHANGED: "tenant.entitlement.changed.v1",
  TENANT_USAGE_RECORDED: "tenant.usage.recorded.v1",

  // Identity & Access (PRD Module 1)
  IDENTITY_USER_INVITED: "identity.user.invited.v1",
  IDENTITY_USER_ACTIVATED: "identity.user.activated.v1",
  IDENTITY_TENANT_MEMBERSHIP_CHANGED: "identity.tenant_membership.changed.v1",
  IDENTITY_ACCESS_GRANT_CHANGED: "identity.access_grant.changed.v1",

  // Organization & Employee (PRD Module 2)
  ORGANIZATION_EMPLOYEE_CREATED: "organization.employee.created.v1",
  ORGANIZATION_EMPLOYEE_STATUS_CHANGED: "organization.employee.status_changed.v1",
  ORGANIZATION_REPORTING_LINE_CHANGED: "organization.reporting_line.changed.v1",
  ORGANIZATION_TEAM_MEMBERSHIP_CHANGED: "organization.team.membership.changed.v1",
  ORGANIZATION_ACCESS_GROUP_MEMBERSHIP_CHANGED: "organization.access_group.membership.changed.v1",

  // Recruitment & ATS (PRD Module 3 & 4)
  RECRUITMENT_REQUISITION_APPROVED: "recruitment.requisition.approved.v1",
  RECRUITMENT_CANDIDATE_STAGE_CHANGED: "recruitment.candidate.stage_changed.v1",
  RECRUITMENT_OFFER_ACCEPTED: "recruitment.offer.accepted.v1",
  ONBOARDING_TASK_COMPLETED: "onboarding.task.completed.v1",
  PEOPLE_PROBATION_REVIEW_DUE: "people.probation.review_due.v1",
  PEOPLE_PROBATION_DECISION_RECORDED: "people.probation.decision_recorded.v1",

  // Attendance & Leave (PRD Module 5)
  ATTENDANCE_PUNCH_RECORDED: "attendance.punch.recorded.v1",
  ATTENDANCE_CORRECTION_APPROVED: "attendance.correction.approved.v1",
  LEAVE_REQUEST_SUBMITTED: "leave.request.submitted.v1",
  LEAVE_REQUEST_DECIDED: "leave.request.decided.v1",

  // Work Management & Tickets (PRD Module 6 & 7)
  WORK_TICKET_CREATED: "work.ticket.created.v1",
  WORK_TICKET_ASSIGNED: "work.ticket.assigned.v1",
  WORK_TICKET_STATUS_CHANGED: "work.ticket.status_changed.v1",
  WORK_TICKET_SLA_BREACHED: "work.ticket.sla_breached.v1",

  // Projects, Releases & Delivery (PRD Module 8)
  PROJECT_APPROVED: "project.approved.v1",
  PROJECT_MILESTONE_ACCEPTED: "project.milestone.accepted.v1",
  RELEASE_GATE_PASSED: "release.gate_passed.v1",
  RELEASE_APPROVED: "release.approved.v1",
  RELEASE_DEPLOYED: "release.deployed.v1",
  RELEASE_ROLLBACK_TRIGGERED: "release.rollback_triggered.v1",

  // CRM & Presales (PRD Module 9 & 10)
  CRM_LEAD_CREATED: "crm.lead.created.v1",
  CRM_OPPORTUNITY_STAGE_CHANGED: "crm.opportunity.stage_changed.v1",
  PRESALES_PROPOSAL_SUBMITTED: "presales.proposal.submitted.v1",
  PRESALES_PROPOSAL_APPROVED: "presales.proposal.approved.v1",

  // Resource Planning (PRD Module 11)
  RESOURCE_ALLOCATION_REQUESTED: "resource.allocation.requested.v1",
  RESOURCE_ALLOCATION_APPROVED: "resource.allocation.approved.v1",
  RESOURCE_CAPACITY_CONFLICT_DETECTED: "resource.capacity_conflict.detected.v1",

  // Finance Operations (PRD Module 12)
  FINANCE_INVOICE_ISSUED: "finance.invoice.issued.v1",
  FINANCE_PAYMENT_RECORDED: "finance.payment.recorded.v1",
  FINANCE_RECEIVABLE_OVERDUE: "finance.receivable.overdue.v1",
  FINANCE_COMMERCIAL_EXCEPTION_APPROVED: "finance.commercial_exception.approved.v1",

  // Workflow & Approvals (PRD Module 13)
  WORKFLOW_APPROVAL_CREATED: "workflow.approval.created.v1",
  WORKFLOW_APPROVAL_DECIDED: "workflow.approval.decided.v1",
  WORKFLOW_APPROVAL_ESCALATED: "workflow.approval.escalated.v1",

  // Documents & Notifications (PRD Module 14 & 15)
  DOCUMENT_UPLOADED: "document.uploaded.v1",
  DOCUMENT_VERIFICATION_UPDATED: "document.verification.updated.v1",
  NOTIFICATION_DELIVERY_FAILED: "notification.delivery.failed.v1",
} as const;

export type DomainEventName = typeof DomainEventNames[keyof typeof DomainEventNames];

export interface CreateEventParams<T = Record<string, unknown>> {
  name: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
  version?: number;
}

/**
 * Factory to create a properly formatted, compliant DomainEvent.
 * Enforces PRD §11 payload constraints and metadata standards.
 */
export function createDomainEvent<T = Record<string, unknown>>(
  params: CreateEventParams<T>
): DomainEvent<T> {
  if (!params.tenantId) {
    throw new Error("Cannot create DomainEvent: tenantId must be non-empty string or 'system'");
  }
  if (!params.name) {
    throw new Error("Cannot create DomainEvent: name is required");
  }
  if (!params.aggregateId || !params.aggregateType) {
    throw new Error("Cannot create DomainEvent: aggregateId and aggregateType are required");
  }

  return {
    id: randomUUID(),
    name: params.name,
    tenantId: params.tenantId,
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    version: params.version ?? 1,
    timestamp: new Date().toISOString(),
    correlationId: params.correlationId || randomUUID().replace(/-/g, ""),
    causationId: params.causationId,
    payload: params.payload,
    metadata: params.metadata,
  };
}
