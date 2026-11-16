// Project & Workforce domain lib — PRD Modules 8 + 7 + 11
export const PROJECT_STATUSES = [
  "proposed",
  "pending_approval",
  "approved",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TICKET_STATUSES = [
  "open",
  "triaged",
  "in_progress",
  "in_review",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TYPES = ["bug", "feature", "task", "incident", "support"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const MILESTONE_STATUSES = ["pending", "in_progress", "completed", "missed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

// Normal (PATCH-able) transitions. Governed targets excluded — use POST endpoints.
const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  proposed: ["pending_approval"],
  pending_approval: [],
  approved: ["active", "on_hold"],
  active: ["on_hold", "completed"],
  on_hold: ["active", "completed"],
  completed: [],
  cancelled: [],
};

const TICKET_TRANSITIONS: Record<string, TicketStatus[]> = {
  open: ["triaged"],
  triaged: ["in_progress"],
  in_progress: ["in_review", "resolved"],
  in_review: ["in_progress", "resolved"],
  resolved: ["in_progress"],
  closed: [],
};

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return (PROJECT_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionTicket(from: TicketStatus, to: string): boolean {
  return (TICKET_TRANSITIONS[from] ?? []).includes(to as TicketStatus);
}

// Governed transitions — PATCH must reject; dedicated POST required
export function isGovernedProjectStatus(status: string): boolean {
  return status === "approved" || status === "cancelled";
}

export function isGovernedTicketStatus(status: string): boolean {
  return status === "closed";
}

// Over-allocation check: total percentage for employee across overlapping allocations
export interface AllocationWindow {
  employeeId?: string;
  percentage: number;
  startDate: string | Date;
  endDate: string | Date;
  id?: string;
}

export function checkOverAllocation(
  existing: AllocationWindow[],
  proposed: AllocationWindow,
  excludeId?: string
): { ok: true } | { ok: false; error: string } {
  const pStart = new Date(proposed.startDate).getTime();
  const pEnd = new Date(proposed.endDate).getTime();
  let total = proposed.percentage;
  for (const a of existing) {
    if (excludeId && a.id === excludeId) continue;
    const aStart = new Date(a.startDate).getTime();
    const aEnd = new Date(a.endDate).getTime();
    if (aStart <= pEnd && aEnd >= pStart) {
      total += a.percentage;
    }
  }
  if (total > 100) {
    return {
      ok: false,
      error: `Over-allocated: employee has ${total}% active in overlapping period`,
    };
  }
  return { ok: true };
}

export function isValidProjectStatus(s: string): s is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(s);
}

export function isValidTicketStatus(s: string): s is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(s);
}

export function isValidTicketType(s: string): s is TicketType {
  return (TICKET_TYPES as readonly string[]).includes(s);
}

export function isValidTicketPriority(s: string): s is TicketPriority {
  return (TICKET_PRIORITIES as readonly string[]).includes(s);
}

export function isValidMilestoneStatus(s: string): s is MilestoneStatus {
  return (MILESTONE_STATUSES as readonly string[]).includes(s);
}

// Budget: integer cents only (never binary float)
export function parseBudgetToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const cents = parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return cents;
}

export function isValidCents(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && Number.MAX_SAFE_INTEGER > n;
}

export function formatCents(cents: number | bigint | null): string {
  if (cents === null || cents === undefined) return "—";
  const n = typeof cents === "bigint" ? Number(cents) : cents;
  return `$${(n / 100).toFixed(2)}`;
}
