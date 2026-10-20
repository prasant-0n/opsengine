import type { AuthorizationContext } from "./context";
import { PERMISSIONS } from "./permissions";

// Separation-of-duties (PRD §3.4.5): a requester cannot approve their own
// request when SoD policy prohibits it, even if organizational level would
// otherwise permit it. A dedicated sod.override permission breaks the glass.
export function checkSoD(
  ctx: AuthorizationContext,
  action: string,
  resource: { requesterEmployeeId?: string | null } | null,
): { blocked: boolean; reason?: string } {
  const isApproval = action.endsWith(".approve") || action.endsWith(".approve_stage") ||
    action.endsWith(".signoff") || action.endsWith("_signoff") ||
    action === PERMISSIONS.HR_LEAVE_APPROVE ||
    action === PERMISSIONS.FINANCE_COMMERCIAL_TERMS_APPROVE ||
    action === PERMISSIONS.RELEASE_BUSINESS_SIGNOFF ||
    action === PERMISSIONS.RELEASE_TECHNICAL_APPROVE ||
    action === PERMISSIONS.CRM_OPPORTUNITY_APPROVE_STAGE;

  if (!isApproval) return { blocked: false };
  if (!resource?.requesterEmployeeId || !ctx.employeeId) return { blocked: false };
  if (resource.requesterEmployeeId !== ctx.employeeId) return { blocked: false };

  const hasOverride = ctx.permissions.some((p) => p.key === PERMISSIONS.SOD_OVERRIDE);
  if (hasOverride) return { blocked: false };

  return { blocked: true, reason: "SOD_SELF_APPROVAL" };
}
