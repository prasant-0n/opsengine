// Feature #11 — Onboarding, Induction & Probation domain library (PRD Module 4).
// Derived values only; no money here. All status/recommendation vocabularies are data.

export const ONBOARDING_PLAN_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
export type OnboardingPlanStatus = (typeof ONBOARDING_PLAN_STATUSES)[number];

export const ONBOARDING_TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "blocked",
  "waived",
  "cancelled",
] as const;
export type OnboardingTaskStatus = (typeof ONBOARDING_TASK_STATUSES)[number];

export const ONBOARDING_TASK_CATEGORIES = [
  "hr",
  "it",
  "manager",
  "finance",
  "employee",
  "document",
  "policy",
  "training",
] as const;
export type OnboardingTaskCategory = (typeof ONBOARDING_TASK_CATEGORIES)[number];

export const PROBATION_STATUSES = ["pending", "in_review", "completed"] as const;
export type ProbationStatus = (typeof PROBATION_STATUSES)[number];

export const PROBATION_RECOMMENDATIONS = ["confirm", "extend", "terminate"] as const;
export type ProbationRecommendation = (typeof PROBATION_RECOMMENDATIONS)[number];

export function isKnownPlanStatus(v: unknown): v is OnboardingPlanStatus {
  return typeof v === "string" && (ONBOARDING_PLAN_STATUSES as readonly string[]).includes(v);
}
export function isKnownTaskStatus(v: unknown): v is OnboardingTaskStatus {
  return typeof v === "string" && (ONBOARDING_TASK_STATUSES as readonly string[]).includes(v);
}
export function isKnownTaskCategory(v: unknown): v is OnboardingTaskCategory {
  return typeof v === "string" && (ONBOARDING_TASK_CATEGORIES as readonly string[]).includes(v);
}
export function isKnownProbationStatus(v: unknown): v is ProbationStatus {
  return typeof v === "string" && (PROBATION_STATUSES as readonly string[]).includes(v);
}
export function isKnownProbationRecommendation(v: unknown): v is ProbationRecommendation {
  return typeof v === "string" && (PROBATION_RECOMMENDATIONS as readonly string[]).includes(v);
}

// ---- Completion derivation ----

// A task counts toward completion only when completed or waived.
// Cancelled tasks are excluded from the denominator entirely.
export function taskCountsTowardCompletion(status: OnboardingTaskStatus): boolean {
  return status === "completed" || status === "waived";
}

export function deriveCompletionPct(tasks: Array<{ status: OnboardingTaskStatus }>): number {
  const considered = tasks.filter((t) => t.status !== "cancelled");
  if (considered.length === 0) return 0;
  const done = considered.filter((t) => taskCountsTowardCompletion(t.status)).length;
  return Math.round((done / considered.length) * 100);
}

// ---- Dependency gating ----

export interface TaskDependencyView {
  taskId: string;
  dependsOnTaskId: string;
}

// A task is blocked by an incomplete dependency: you cannot complete it while any
// prerequisite task is not itself completed (or waived).
export function dependencyBlocked(
  taskId: string,
  dependencies: TaskDependencyView[],
  statusById: Map<string, OnboardingTaskStatus>,
): boolean {
  const prereqs = dependencies.filter((d) => d.taskId === taskId).map((d) => d.dependsOnTaskId);
  for (const p of prereqs) {
    const s = statusById.get(p);
    if (s === undefined) continue;
    if (!taskCountsTowardCompletion(s)) return true;
  }
  return false;
}

// Detect a cycle introduced by a proposed edge (taskId depends on dependsOnTaskId).
export function wouldCreateCycle(
  existing: TaskDependencyView[],
  taskId: string,
  dependsOnTaskId: string,
): boolean {
  if (taskId === dependsOnTaskId) return true;
  // Walk ancestors of dependsOnTaskId; if we reach taskId, adding the edge closes a cycle.
  const parentsOf = new Map<string, string[]>();
  for (const d of existing) {
    const arr = parentsOf.get(d.taskId) ?? [];
    arr.push(d.dependsOnTaskId);
    parentsOf.set(d.taskId, arr);
  }
  const seen = new Set<string>();
  const stack = [dependsOnTaskId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const p of parentsOf.get(cur) ?? []) stack.push(p);
  }
  return false;
}

// ---- Probation ----

export function isProbationDue(dueOn: Date | null | undefined, now: Date, status: ProbationStatus): boolean {
  if (status === "completed") return false;
  if (!dueOn) return false;
  return dueOn.getTime() <= now.getTime();
}

// ---- Conversion gate ----

// Convert to employee when the plan is completed, or the probation review is confirmed.
export function canConvert(input: {
  planStatus: OnboardingPlanStatus;
  hasConfirmation: boolean;
}): boolean {
  return input.hasConfirmation || input.planStatus === "completed";
}
