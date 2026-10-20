import { describe, it, expect } from "vitest";
import {
  PLAN_STATUSES,
  ITEM_STATUSES,
  ATTENDANCE_STATUSES,
  CORRECTION_STATUSES,
  ITEM_PRIORITIES,
  PLAN_STATUSES as _PS,
  isValidPlanStatus,
  isValidItemStatus,
  isValidAttendanceStatus,
  isValidCorrectionStatus,
  isValidItemPriority,
  canEditPlanItems,
  canSubmitPlan,
  canReviewPlan,
  isValidMinutes,
  formatMinutes,
  deriveDailyReport,
  weekRange,
  sumTimeEntries,
} from "../features/time/lib/time";
import { PERMISSIONS } from "../lib/permissions/permissions";

describe("Time domain enums", () => {
  it("exposes the plan lifecycle", () => {
    expect(PLAN_STATUSES).toEqual(["draft", "submitted", "reviewed"]);
    expect(isValidPlanStatus("draft")).toBe(true);
    expect(isValidPlanStatus("reviewed")).toBe(true);
    expect(isValidPlanStatus("closed")).toBe(false);
  });

  it("exposes item statuses and priorities", () => {
    expect(ITEM_STATUSES).toContain("carried_forward");
    expect(isValidItemStatus("blocked")).toBe(true);
    expect(isValidItemStatus("done")).toBe(false);
    expect(ITEM_PRIORITIES).toEqual(["low", "medium", "high", "critical"]);
    expect(isValidItemPriority("critical")).toBe(true);
    expect(isValidItemPriority("urgent")).toBe(false);
  });

  it("exposes attendance + correction statuses", () => {
    expect(ATTENDANCE_STATUSES).toContain("correction_requested");
    expect(isValidAttendanceStatus("checked_out")).toBe(true);
    expect(isValidAttendanceStatus("on_break")).toBe(false);
    expect(CORRECTION_STATUSES).toEqual(["pending", "approved", "rejected"]);
    expect(isValidCorrectionStatus("approved")).toBe(true);
    expect(isValidCorrectionStatus("cancelled")).toBe(false);
  });
});

describe("Plan immutability / governance rules", () => {
  it("only draft plans are editable", () => {
    expect(canEditPlanItems("draft")).toBe(true);
    expect(canEditPlanItems("submitted")).toBe(false);
    expect(canEditPlanItems("reviewed")).toBe(false);
  });

  it("only draft plans may be submitted", () => {
    expect(canSubmitPlan("draft")).toBe(true);
    expect(canSubmitPlan("submitted")).toBe(false);
    expect(canSubmitPlan("reviewed")).toBe(false);
  });

  it("only submitted plans can be reviewed", () => {
    expect(canReviewPlan("submitted")).toBe(true);
    expect(canReviewPlan("draft")).toBe(false);
    expect(canReviewPlan("reviewed")).toBe(false);
  });
});

describe("Minutes validation (1..1440)", () => {
  it("accepts integer minutes within a single day", () => {
    expect(isValidMinutes(1)).toBe(true);
    expect(isValidMinutes(1440)).toBe(true);
    expect(isValidMinutes(60)).toBe(true);
  });

  it("rejects zero, negatives, over-a-day, floats and non-numbers", () => {
    expect(isValidMinutes(0)).toBe(false);
    expect(isValidMinutes(-30)).toBe(false);
    expect(isValidMinutes(1441)).toBe(false);
    expect(isValidMinutes(90.5)).toBe(false);
    expect(isValidMinutes("60")).toBe(false);
  });

  it("formats minutes as h/m", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(null)).toBe("—");
  });
});

describe("Daily report derivation (planned vs actual)", () => {
  const items = [
    { status: "completed", estimatedMinutes: 60, actualMinutes: 75 },
    { status: "in_progress", estimatedMinutes: 90, actualMinutes: 30 },
    { status: "blocked", estimatedMinutes: 30, actualMinutes: null },
    { status: "carried_forward", estimatedMinutes: 15, actualMinutes: null },
    { status: "planned", estimatedMinutes: 45, actualMinutes: null },
  ];

  it("sums planned and actual minutes", () => {
    const r = deriveDailyReport(items);
    expect(r.plannedMinutes).toBe(240);
    expect(r.actualMinutes).toBe(105);
    expect(r.varianceMinutes).toBe(-135);
  });

  it("counts items by status", () => {
    const r = deriveDailyReport(items);
    expect(r.totalItems).toBe(5);
    expect(r.completed).toBe(1);
    expect(r.inProgress).toBe(1);
    expect(r.blocked).toBe(1);
    expect(r.carriedForward).toBe(1);
    expect(r.plannedOnly).toBe(1);
  });

  it("handles an empty plan", () => {
    const r = deriveDailyReport([]);
    expect(r.plannedMinutes).toBe(0);
    expect(r.actualMinutes).toBe(0);
    expect(r.totalItems).toBe(0);
  });
});

describe("Week range (Mon–Sun)", () => {
  it("returns Monday→Sunday for a mid-week date", () => {
    // 2026-10-21 is a Wednesday
    expect(weekRange("2026-10-21")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });

  it("keeps a Monday as the start", () => {
    expect(weekRange("2026-10-19")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });

  it("maps a Sunday back to the preceding Monday", () => {
    expect(weekRange("2026-10-25")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });
});

describe("Time entry totals (billable vs non-billable)", () => {
  it("separates the three counters", () => {
    const t = sumTimeEntries([
      { minutes: 60, billable: true },
      { minutes: 30, billable: true },
      { minutes: 90, billable: false },
    ]);
    expect(t.totalMinutes).toBe(180);
    expect(t.billableMinutes).toBe(90);
    expect(t.nonBillableMinutes).toBe(90);
  });

  it("handles no entries", () => {
    const t = sumTimeEntries([]);
    expect(t).toEqual({ totalMinutes: 0, billableMinutes: 0, nonBillableMinutes: 0 });
  });
});

describe("Time permission keys (catalog)", () => {
  it("defines all nine e9xx keys", () => {
    const keys = [
      PERMISSIONS.TIME_ENTRY_READ_SELF,
      PERMISSIONS.TIME_ENTRY_CREATE,
      PERMISSIONS.TIME_ENTRY_UPDATE,
      PERMISSIONS.TIME_DAR_CREATE,
      PERMISSIONS.TIME_DAR_SUBMIT,
      PERMISSIONS.TIME_DAR_REVIEW,
      PERMISSIONS.TIME_ATTENDANCE_CHECKIN,
      PERMISSIONS.TIME_ATTENDANCE_READ_SELF,
      PERMISSIONS.TIME_ATTENDANCE_CORRECT,
    ];
    for (const k of keys) {
      expect(k.startsWith("time.")).toBe(true);
    }
    expect(new Set(keys).size).toBe(9);
  });
});
