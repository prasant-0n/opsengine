import type { AuthorizationContext } from "./context";
import { scopeAllows, type ResourceScope } from "./scopes";
import { checkSoD } from "./sod";
import { writeAudit } from "./audit";
import { recordRebacDecision } from "@opsengine/telemetry";

export interface DecisionResource extends ResourceScope {
  id?: string;
  resourceType?: string;
  requesterEmployeeId?: string | null;
}

export interface RequestContext {
  action: string;
  resource?: DecisionResource | null;
  audit?: boolean; // force audit this decision
}

export interface Decision {
  allowed: boolean;
  reasonCode: string;
  matchedScope?: { type: string; scopeId: string | null };
  policyVersion?: number;
}

const CONTEXT_STALE_MS = 60_000;

// PRD §3.4.1 ordered decision contract — deny by default.
export function authorize(
  subject: AuthorizationContext,
  action: string,
  resource: DecisionResource | null,
  requestContext?: { audit?: boolean },
): Decision {
  const decision = decide(subject, action, resource);
  try {
    recordRebacDecision(subject.tenantId, decision.allowed ? "ALLOW" : "DENY", action);
  } catch {
    // Non-blocking telemetry
  }
  const shouldAudit =
    requestContext?.audit ||
    !decision.allowed ||
    action.includes("approve") ||
    action.includes("manage") ||
    action.includes("delete");

  if (shouldAudit) {
    writeAudit({
      tenantId: subject.tenantId,
      actorUserId: subject.userId,
      eventType: "authz.decision",
      resourceType: resource?.resourceType ?? null,
      resourceId: resource?.id ?? null,
      decision: decision.allowed ? "allow" : "deny",
      reasonCode: decision.reasonCode,
      policyVersion: decision.policyVersion ?? null,
    });
  }

  return decision;
}

function decide(
  subject: AuthorizationContext,
  action: string,
  resource: DecisionResource | null,
): Decision {
  const deny = (reasonCode: string): Decision => ({
    allowed: false,
    reasonCode,
    policyVersion: subject.policyVersion,
  });

  // 1. Context freshness — fail closed (PRD §3.4.6)
  if (Date.now() - subject.builtAt > CONTEXT_STALE_MS) {
    return deny("STALE_CONTEXT");
  }

  // 2. Active tenant membership
  if (subject.membershipStatus !== "active") {
    return deny("NO_MEMBERSHIP");
  }

  // 3. Tenant match on resource (missing tenant scope = deny)
  if (resource && resource.tenantId !== subject.tenantId) {
    return deny("TENANT_MISMATCH");
  }

  // 4. Permission grant on action (RBAC leg)
  const grants = subject.permissions.filter((p) => p.key === action);
  if (grants.length === 0) {
    return deny("NO_PERMISSION");
  }

  // 5. Scope / relationship (ReBAC leg) + ABAC (SBU/TENANT attributes)
  let matched: Decision["matchedScope"];
  const resourceForScope: DecisionResource | null = resource
    ? { ...resource }
    : null;

  for (const grant of grants) {
    if (scopeAllows(subject, grant.scopeType, grant.scopeId, resourceForScope)) {
      matched = { type: grant.scopeType, scopeId: grant.scopeId };
      break;
    }
  }
  if (!matched) {
    return deny("NO_SCOPE");
  }

  // 6. Separation-of-duties / ABAC conditions
  const sod = checkSoD(subject, action, resource);
  if (sod.blocked) {
    return deny(sod.reason ?? "SOD_BLOCKED");
  }

  // Employee identity unresolved → deny anything beyond self-service
  // (handled above: SELF scope requires employeeId match; TENANT etc. also
  //  require an employee for relationship checks in consuming services)
  if (!subject.employeeId && grantNeedsEmployee(action)) {
    return deny("NO_EMPLOYEE_LINK");
  }

  return {
    allowed: true,
    reasonCode: "ALLOWED",
    matchedScope: matched,
    policyVersion: subject.policyVersion,
  };
}

function grantNeedsEmployee(action: string): boolean {
  // Self-service identity actions work without an employee record
  const selfService = new Set([
    "profile.read_self",
    "profile.update_self",
    "session.manage_self",
  ]);
  return !selfService.has(action);
}

// Field-level visibility (PRD §3.4.1 step 6): a resource-level read permission
// must not reveal every field. Callers project DTOs through this.
export function visibleFields<T extends Record<string, unknown>>(
  subject: AuthorizationContext,
  resource: DecisionResource | null,
  fields: T,
  sensitiveKeys: readonly string[],
): Partial<T> {
  const canSeeSensitive =
    subject.permissions.some((p) =>
      p.key.endsWith(".read_sensitive") || p.key.endsWith(".verify"),
    ) &&
    (!resource || resource.tenantId === subject.tenantId);

  if (canSeeSensitive) return fields;

  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (sensitiveKeys.includes(k)) continue;
    out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
