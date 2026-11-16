import { prisma } from "@/lib/prisma";
import {
  resolveApprovers,
  applyDelegations,
  type StepRule,
  type ResolverInputs,
  type DelegationRecord,
} from "./approvals";

/**
 * Load the data needed to resolve approvers for a tenant, and resolve the given
 * rules to concrete employee id sets. Steps below their amount threshold are
 * returned with `skipped: true` (no approvers needed).
 */
export async function resolveStepsForTenant(
  tenantId: string,
  requesterEmployeeId: string,
  rules: StepRule[],
  subjectType: string,
  definitionId: string | null,
  amountCents: number | null,
  now: Date = new Date(),
): Promise<Array<{ rule: StepRule; approverIds: string[]; skipped: boolean }>> {
  const [employees, relationships, roleGrants, permissionGrants, delegations] = await Promise.all([
    prisma.employee.findMany({ where: { tenantId }, select: { id: true, employmentStatus: true } }),
    prisma.reportingRelationship.findMany({
      where: { tenantId },
      select: { managerEmployeeId: true, reportEmployeeId: true, validFrom: true, validTo: true },
    }),
    prisma.roleGrant.findMany({
      where: { tenantId },
      select: { roleKey: true, principalEmployeeId: true, validFrom: true, validTo: true },
    }),
    prisma.permissionGrant.findMany({
      where: { tenantId },
      select: { permissionKey: true, principalEmployeeId: true, validFrom: true, validTo: true },
    }),
    prisma.approvalDelegation.findMany({
      where: { tenantId, active: true },
      select: { fromEmployeeId: true, toEmployeeId: true, scopeType: true, scopeValue: true, startDate: true, endDate: true, active: true },
    }),
  ]);

  const inputs: ResolverInputs = {
    tenantId,
    requesterEmployeeId,
    employees,
    relationships,
    roleGrants,
    permissionGrants,
    now,
  };
  const delegationRecords: DelegationRecord[] = delegations.map((d) => ({
    fromEmployeeId: d.fromEmployeeId,
    toEmployeeId: d.toEmployeeId,
    scopeType: d.scopeType,
    scopeValue: d.scopeValue,
    startDate: d.startDate,
    endDate: d.endDate,
    active: d.active,
  }));

  return rules.map((rule) => {
    const skipped =
      rule.amountThresholdCents !== undefined &&
      amountCents !== null &&
      amountCents < rule.amountThresholdCents;
    if (skipped) return { rule, approverIds: [], skipped: true };
    const base = resolveApprovers(rule, inputs);
    const expanded = applyDelegations(base, subjectType, definitionId, delegationRecords, now);
    const skipBecauseEmpty = expanded.length === 0;
    return { rule, approverIds: expanded, skipped: skipBecauseEmpty };
  });
}

/** The latest published version for a subject type (tenant-scoped), if any. */
export async function findPublishedWorkflow(tenantId: string, subjectType: string) {
  const definition = await prisma.workflowDefinition.findFirst({
    where: { tenantId, subjectType, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!definition) return null;
  const version = await prisma.workflowVersion.findFirst({
    where: { tenantId, definitionId: definition.id, status: "published" },
    orderBy: { versionNumber: "desc" },
  });
  if (!version) return null;
  return { definition, version };
}
