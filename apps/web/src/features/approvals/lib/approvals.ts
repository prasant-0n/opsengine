// Feature #9 — Workflow & Approval Engine domain library (PRD Module 13).
// Configuration is validated JSON data with a fixed vocabulary; never executed code.

export const SUBJECT_TYPES = [
  "project",
  "ticket",
  "daily_plan",
  "attendance_correction",
  "allocation",
  "general",
] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const INSTANCE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "superseded",
] as const;
export type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

export const STEP_STATUSES = ["pending", "approved", "rejected", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const DECISION_TYPES = [
  "approve",
  "reject",
  "request_changes",
  "delegate",
  "withdraw",
  "escalate",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const RESOLVER_TYPES = [
  "ROLE",
  "REPORTING_MANAGER_OF_REQUESTER",
  "REPORTING_TREE_OF_REQUESTER",
  "NAMED_EMPLOYEE",
  "PERMISSION",
] as const;
export type ResolverType = (typeof RESOLVER_TYPES)[number];

export const STEP_MODES = ["all", "any"] as const;
export type StepMode = (typeof STEP_MODES)[number];

export const WORKFLOW_VERSION_STATUSES = ["draft", "published", "retired"] as const;
export type WorkflowVersionStatus = (typeof WORKFLOW_VERSION_STATUSES)[number];

export const DELEGATION_SCOPE_TYPES = ["ALL", "SUBJECT_TYPE", "SPECIFIC_DEFINITION"] as const;
export type DelegationScopeType = (typeof DELEGATION_SCOPE_TYPES)[number];

export interface StepRule {
  stepNumber: number;
  name: string;
  mode: StepMode;
  resolver: { type: ResolverType; role?: string; permission?: string; employeeId?: string };
  minApprovals: number;
  amountThresholdCents?: number;
}

export interface WorkflowRules {
  steps: StepRule[];
}

export function isKnownSubjectType(v: unknown): v is SubjectType {
  return typeof v === "string" && (SUBJECT_TYPES as readonly string[]).includes(v);
}

export function isKnownResolver(v: unknown): v is ResolverType {
  return typeof v === "string" && (RESOLVER_TYPES as readonly string[]).includes(v);
}

export function isKnownStepMode(v: unknown): v is StepMode {
  return typeof v === "string" && (STEP_MODES as readonly string[]).includes(v);
}

// Any string that looks like executable code / template expression is rejected.
const EXECUTABLE_MARKERS = ["(", ")", "=>", "{{", "eval", "function", ";", "`"];

function hasExecutableMarker(s: string): boolean {
  const lower = s.toLowerCase();
  return EXECUTABLE_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

const ALLOWED_STEP_KEYS = new Set([
  "stepNumber",
  "name",
  "mode",
  "resolver",
  "minApprovals",
  "amountThresholdCents",
]);
const ALLOWED_RESOLVER_KEYS = new Set(["type", "role", "permission", "employeeId"]);

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

/**
 * Validate a workflow `rules` payload. Returns {ok, errors}; never throws, never
 * evaluates. Unknown keys, executable-looking strings, and bad numbers are rejected.
 */
export function validateWorkflowRules(rules: unknown): { ok: boolean; errors: string[]; value?: WorkflowRules } {
  const errors: string[] = [];
  if (rules === null || typeof rules !== "object" || Array.isArray(rules)) {
    return { ok: false, errors: ["rules must be an object"] };
  }
  const r = rules as Record<string, unknown>;
  const extraTop = Object.keys(r).filter((k) => k !== "steps");
  if (extraTop.length) errors.push(`unknown keys: ${extraTop.join(",")}`);
  if (!Array.isArray(r.steps) || r.steps.length === 0) {
    errors.push("steps must be a non-empty array");
    return { ok: false, errors };
  }

  const steps: StepRule[] = [];
  r.steps.forEach((raw, i) => {
    const at = `steps[${i}]`;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`${at} must be an object`);
      return;
    }
    const s = raw as Record<string, unknown>;
    for (const k of Object.keys(s)) {
      if (!ALLOWED_STEP_KEYS.has(k)) errors.push(`${at} unknown key '${k}'`);
    }
    if (!isPositiveInt(s.stepNumber)) errors.push(`${at}.stepNumber must be a positive integer`);
    if (typeof s.name !== "string" || s.name.trim() === "" || hasExecutableMarker(s.name)) {
      errors.push(`${at}.name must be a non-empty string without executable syntax`);
    }
    if (!isKnownStepMode(s.mode)) errors.push(`${at}.mode must be 'all' or 'any'`);
    if (!isPositiveInt(s.minApprovals)) errors.push(`${at}.minApprovals must be an integer >= 1`);
    if (s.amountThresholdCents !== undefined) {
      if (typeof s.amountThresholdCents !== "number" || !Number.isInteger(s.amountThresholdCents) || s.amountThresholdCents < 0) {
        errors.push(`${at}.amountThresholdCents must be a non-negative integer`);
      }
    }

    const res = s.resolver;
    if (res === null || typeof res !== "object" || Array.isArray(res)) {
      errors.push(`${at}.resolver must be an object`);
      return;
    }
    const rr = res as Record<string, unknown>;
    for (const k of Object.keys(rr)) {
      if (!ALLOWED_RESOLVER_KEYS.has(k)) errors.push(`${at}.resolver unknown key '${k}'`);
    }
    if (!isKnownResolver(rr.type)) {
      errors.push(`${at}.resolver.type must be one of ${RESOLVER_TYPES.join("|")}`);
      return;
    }
    if (rr.type === "ROLE") {
      if (typeof rr.role !== "string" || rr.role.trim() === "" || hasExecutableMarker(rr.role)) {
        errors.push(`${at}.resolver.role required for ROLE`);
      }
    } else if (rr.type === "PERMISSION") {
      if (typeof rr.permission !== "string" || rr.permission.trim() === "" || hasExecutableMarker(rr.permission)) {
        errors.push(`${at}.resolver.permission required for PERMISSION`);
      }
    } else if (rr.type === "NAMED_EMPLOYEE") {
      if (typeof rr.employeeId !== "string" || rr.employeeId.trim() === "" || hasExecutableMarker(rr.employeeId)) {
        errors.push(`${at}.resolver.employeeId required for NAMED_EMPLOYEE`);
      }
    }

    if (errors.length === 0) {
      steps.push({
        stepNumber: s.stepNumber as number,
        name: s.name as string,
        mode: s.mode as StepMode,
        resolver: rr.type === "ROLE"
          ? { type: "ROLE", role: rr.role as string }
          : rr.type === "PERMISSION"
            ? { type: "PERMISSION", permission: rr.permission as string }
            : rr.type === "NAMED_EMPLOYEE"
              ? { type: "NAMED_EMPLOYEE", employeeId: rr.employeeId as string }
              : { type: rr.type as ResolverType },
        minApprovals: s.minApprovals as number,
        ...(s.amountThresholdCents !== undefined
          ? { amountThresholdCents: s.amountThresholdCents as number }
          : {}),
      });
    }
  });

  // Step numbers must be unique and contiguous from 1 (order matters).
  const numbers = steps.map((s) => s.stepNumber).sort((a, b) => a - b);
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      errors.push("stepNumber values must be unique and contiguous starting at 1");
      break;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], value: { steps: steps.sort((a, b) => a.stepNumber - b.stepNumber) } };
}

/** A step is skipped when the instance amount is below its configured threshold. */
export function isStepSkipped(amountCents: number | null | undefined, thresholdCents: number | null | undefined): boolean {
  if (thresholdCents === null || thresholdCents === undefined) return false;
  if (amountCents === null || amountCents === undefined) return false;
  return amountCents < thresholdCents;
}

export interface ResolverInputs {
  tenantId: string;
  requesterEmployeeId: string;
  employees: Array<{ id: string; employmentStatus: string }>;
  relationships: Array<{ managerEmployeeId: string; reportEmployeeId: string; validFrom: Date; validTo: Date | null }>;
  roleGrants: Array<{ roleKey: string; principalEmployeeId: string | null; validFrom: Date; validTo: Date | null }>;
  permissionGrants: Array<{ permissionKey: string; principalEmployeeId: string | null; validFrom: Date; validTo: Date | null }>;
  now: Date;
}

function isActive(validFrom: Date, validTo: Date | null, now: Date): boolean {
  return validFrom.getTime() <= now.getTime() && (validTo === null || validTo.getTime() >= now.getTime());
}

/**
 * Resolve the employee ids that satisfy a step rule. Pure function over supplied
 * data (no DB access) so it is unit-testable.
 */
export function resolveApprovers(rule: StepRule, inputs: ResolverInputs): string[] {
  const { now } = inputs;
  const activeEmployees = new Set(
    inputs.employees.filter((e) => e.employmentStatus === "active").map((e) => e.id),
  );
  const out = new Set<string>();

  if (rule.resolver.type === "NAMED_EMPLOYEE") {
    const id = rule.resolver.employeeId!;
    if (activeEmployees.has(id)) out.add(id);
    return [...out];
  }

  if (rule.resolver.type === "REPORTING_MANAGER_OF_REQUESTER") {
    for (const rel of inputs.relationships) {
      if (rel.reportEmployeeId === inputs.requesterEmployeeId && isActive(rel.validFrom, rel.validTo, now)) {
        if (activeEmployees.has(rel.managerEmployeeId)) out.add(rel.managerEmployeeId);
      }
    }
    return [...out];
  }

  if (rule.resolver.type === "REPORTING_TREE_OF_REQUESTER") {
    const seen = new Set<string>();
    let frontier = [inputs.requesterEmployeeId];
    for (let depth = 0; depth < 10 && frontier.length; depth++) {
      const next: string[] = [];
      for (const emp of frontier) {
        if (seen.has(emp)) continue;
        seen.add(emp);
        for (const rel of inputs.relationships) {
          if (rel.reportEmployeeId === emp && isActive(rel.validFrom, rel.validTo, now)) {
            if (activeEmployees.has(rel.managerEmployeeId)) out.add(rel.managerEmployeeId);
            next.push(rel.managerEmployeeId);
          }
        }
      }
      frontier = next;
    }
    return [...out];
  }

  if (rule.resolver.type === "ROLE") {
    const roleKey = rule.resolver.role!;
    for (const g of inputs.roleGrants) {
      if (g.roleKey === roleKey && g.principalEmployeeId && isActive(g.validFrom, g.validTo, now)) {
        if (activeEmployees.has(g.principalEmployeeId)) out.add(g.principalEmployeeId);
      }
    }
    return [...out];
  }

  if (rule.resolver.type === "PERMISSION") {
    const key = rule.resolver.permission!;
    for (const g of inputs.permissionGrants) {
      if (g.permissionKey === key && g.principalEmployeeId && isActive(g.validFrom, g.validTo, now)) {
        if (activeEmployees.has(g.principalEmployeeId)) out.add(g.principalEmployeeId);
      }
    }
    return [...out];
  }

  return [];
}

export interface DelegationRecord {
  fromEmployeeId: string;
  toEmployeeId: string;
  scopeType: string;
  scopeValue: string | null;
  startDate: Date;
  endDate: Date;
  active: boolean;
}

/**
 * Expand a set of resolved approver employee ids with any active, in-window
 * delegates. A delegation for `from` maps to `to`; expired/inactive are ignored.
 */
export function applyDelegations(
  approverIds: string[],
  subjectType: string,
  definitionId: string | null,
  delegations: DelegationRecord[],
  now: Date,
): string[] {
  const out = new Set(approverIds);
  for (const d of delegations) {
    if (!d.active) continue;
    if (d.startDate.getTime() > now.getTime() || d.endDate.getTime() < now.getTime()) continue;
    if (!approverIds.includes(d.fromEmployeeId)) continue;
    if (d.scopeType === "SUBJECT_TYPE" && d.scopeValue !== subjectType) continue;
    if (d.scopeType === "SPECIFIC_DEFINITION" && d.scopeValue !== definitionId) continue;
    out.add(d.toEmployeeId);
  }
  return [...out];
}

/** SoD: a requester cannot decide their own instance unless the override is held. */
export function isSelfApproval(
  requesterEmployeeId: string,
  approverEmployeeId: string | null,
): boolean {
  return !!approverEmployeeId && requesterEmployeeId === approverEmployeeId;
}

/** The requester may withdraw their own instance while it is still pending. */
export function canWithdraw(instanceStatus: string, requesterEmployeeId: string, actorEmployeeId: string | null): boolean {
  return instanceStatus === "pending" && !!actorEmployeeId && actorEmployeeId === requesterEmployeeId;
}

/** Whether an approver (already resolved onto the current step) may decide. */
export function canDecideInstance(
  instanceStatus: string,
  stepStatus: string,
  approverIds: string[],
  actorEmployeeId: string | null,
): boolean {
  if (instanceStatus !== "pending") return false;
  if (stepStatus !== "pending") return false;
  if (!actorEmployeeId) return false;
  return approverIds.includes(actorEmployeeId);
}

/** Decide the next instance state after a decision on the current step. */
export function nextStateAfterDecision(
  decision: DecisionType,
  stepMode: StepMode,
  stepApprovalCount: number,
  stepMinApprovals: number,
  hasMoreSteps: boolean,
): { instanceStatus: InstanceStatus | null; stepStatus: StepStatus; advance: boolean } {
  if (decision === "reject") {
    return { instanceStatus: "rejected", stepStatus: "rejected", advance: false };
  }
  if (decision === "request_changes") {
    return { instanceStatus: "rejected", stepStatus: "rejected", advance: false };
  }
  if (decision === "approve") {
    if (stepApprovalCount >= stepMinApprovals) {
      return hasMoreSteps
        ? { instanceStatus: "pending", stepStatus: "approved", advance: true }
        : { instanceStatus: "approved", stepStatus: "approved", advance: false };
    }
    return { instanceStatus: "pending", stepStatus: "pending", advance: false };
  }
  return { instanceStatus: "pending", stepStatus: "pending", advance: false };
}

export function isInstanceOverdue(dueAt: Date | null, status: string, now: Date): boolean {
  if (!dueAt || status !== "pending") return false;
  return dueAt.getTime() < now.getTime();
}

export function describeRules(rules: WorkflowRules): string[] {
  return rules.steps.map((s) => {
    const target =
      s.resolver.type === "ROLE"
        ? `role:${s.resolver.role}`
        : s.resolver.type === "PERMISSION"
          ? `perm:${s.resolver.permission}`
          : s.resolver.type === "NAMED_EMPLOYEE"
            ? "named employee"
            : s.resolver.type === "REPORTING_MANAGER_OF_REQUESTER"
              ? "reporting manager"
              : "reporting tree";
    const thr = s.amountThresholdCents ? ` (≥ ${s.amountThresholdCents}¢)` : "";
    return `Step ${s.stepNumber}: ${s.name} — ${target}, ${s.mode}, min ${s.minApprovals}${thr}`;
  });
}
