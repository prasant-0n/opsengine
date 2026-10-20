import type { AuthorizationContext, ScopeType } from "./context";

export interface ResourceScope {
  tenantId: string;
  owningEmployeeId?: string | null;
  teamIds?: string[];
  sbuId?: string | null;
  projectId?: string | null;
  assignedEmployeeIds?: string[];
  groupId?: string | null;
}

// Returns true if the subject's scope entry covers the resource (PRD §3.4.4).
export function scopeAllows(
  ctx: AuthorizationContext,
  scopeType: ScopeType,
  scopeId: string | null,
  resource: ResourceScope | null,
): boolean {
  switch (scopeType) {
    case "TENANT":
      // TENANT scope requires the dedicated permission (checked by caller);
      // it does NOT include sensitive fields automatically.
      return true;

    case "SELF":
      return !!resource?.owningEmployeeId && resource.owningEmployeeId === ctx.employeeId;

    case "TEAM": {
      if (!resource) return false;
      // scopeId pins a specific team; null means any team the subject belongs to
      const subjectTeamIds = ctx.teamMemberships.map((t) => t.teamId);
      if (scopeId) {
        if (!subjectTeamIds.includes(scopeId)) return false;
        return (resource.teamIds ?? []).includes(scopeId);
      }
      return (resource.teamIds ?? []).some((tid) => subjectTeamIds.includes(tid));
    }

    case "REPORTING_TREE": {
      if (!resource?.owningEmployeeId) return false;
      return ctx.reporting.reportIds.includes(resource.owningEmployeeId);
    }

    case "SBU": {
      if (!resource?.sbuId) return false;
      if (scopeId) return resource.sbuId === scopeId;
      // no pinned SBU on grant — deny (never treat absent scope as global)
      return false;
    }

    case "PROJECT": {
      if (!resource?.projectId) return false;
      return scopeId ? resource.projectId === scopeId : false;
    }

    case "GROUP": {
      if (!resource?.groupId) return false;
      return ctx.accessGroupIds.includes(resource.groupId ?? "") &&
        (!scopeId || resource.groupId === scopeId);
    }

    case "ASSIGNED_CASE": {
      if (!resource?.assignedEmployeeIds) return false;
      return resource.assignedEmployeeIds.includes(ctx.employeeId ?? "");
    }

    default:
      return false;
  }
}
