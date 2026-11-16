// Time & Activity Reporting domain lib — PRD Modules 6 + 5
export const PLAN_STATUSES = ["draft", "submitted", "reviewed"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const ITEM_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "blocked",
  "carried_forward",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  "not_checked_in",
  "checked_in",
  "checked_out",
  "leave",
  "holiday",
  "weekend",
  "absence_pending",
  "correction_requested",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const CORRECTION_STATUSES = ["pending", "approved", "rejected"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const ITEM_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type ItemPriority = (typeof ITEM_PRIORITIES)[number];

export function isValidPlanStatus(s: string): s is PlanStatus {
  return (PLAN_STATUSES as readonly string[]).includes(s);
}
export function isValidItemStatus(s: string): s is ItemStatus {
  return (ITEM_STATUSES as readonly string[]).includes(s);
}
export function isValidAttendanceStatus(s: string): s is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(s);
}
export function isValidCorrectionStatus(s: string): s is CorrectionStatus {
  return (CORRECTION_STATUSES as readonly string[]).includes(s);
}
export function isValidItemPriority(s: string): s is ItemPriority {
  return (ITEM_PRIORITIES as readonly string[]).includes(s);
}

// Governed/immutability rules
export function canEditPlanItems(status: string): boolean {
  return status === "draft";
}

export function canSubmitPlan(status: string): boolean {
  return status === "draft";
}

export function canReviewPlan(status: string): boolean {
  return status === "submitted";
}

// Time-entry minutes: 1..1440 (a single day maximum)
export function isValidMinutes(n: unknown): boolean {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 1440;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface PlanItemLike {
  status: string;
  estimatedMinutes: number;
  actualMinutes?: number | null;
}

export interface DailyReport {
  plannedMinutes: number;
  actualMinutes: number;
  totalItems: number;
  completed: number;
  blocked: number;
  carriedForward: number;
  inProgress: number;
  plannedOnly: number;
  varianceMinutes: number;
}

// Derive planned-vs-actual for a set of plan items. Pure; used by API + UI.
export function deriveDailyReport(items: PlanItemLike[]): DailyReport {
  const plannedMinutes = items.reduce((s, i) => s + (i.estimatedMinutes ?? 0), 0);
  const actualMinutes = items.reduce((s, i) => s + (i.actualMinutes ?? 0), 0);
  const count = (st: string) => items.filter((i) => i.status === st).length;
  return {
    plannedMinutes,
    actualMinutes,
    totalItems: items.length,
    completed: count("completed"),
    blocked: count("blocked"),
    carriedForward: count("carried_forward"),
    inProgress: count("in_progress"),
    plannedOnly: count("planned"),
    varianceMinutes: actualMinutes - plannedMinutes,
  };
}

// Week range (Mon–Sun) for a given date, as YYYY-MM-DD strings
export function weekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() + diffToMon);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

// Meeting/attendance: distinguish the three distinct counters (never interchangeable)
export interface TimeTotals {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
}

export function sumTimeEntries(entries: Array<{ minutes: number; billable: boolean }>): TimeTotals {
  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
  const billableMinutes = entries.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0);
  return { totalMinutes, billableMinutes, nonBillableMinutes: totalMinutes - billableMinutes };
}
