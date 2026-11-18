import { describe, it, expect } from "vitest";
import {
  PROJECT_STATUSES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TICKET_PRIORITIES,
  canTransitionProject,
  canTransitionTicket,
  isGovernedProjectStatus,
  isGovernedTicketStatus,
  isValidProjectStatus,
  isValidTicketStatus,
  isValidTicketType,
  isValidTicketPriority,
  isValidMilestoneStatus,
  checkOverAllocation,
  parseBudgetToCents,
  isValidCents,
  formatCents,
} from "../features/projects/lib/projects";
import { PERMISSIONS } from "../lib/permissions/permissions";

describe("Project transition matrix", () => {
  it("proposed → pending_approval is allowed", () => {
    expect(canTransitionProject("proposed", "pending_approval")).toBe(true);
  });

  it("pending_approval → approved is governed (excluded from PATCH)", () => {
    expect(canTransitionProject("pending_approval", "approved")).toBe(false);
    expect(isGovernedProjectStatus("approved")).toBe(true);
  });

  it("pending_approval → cancelled is governed (excluded from PATCH)", () => {
    expect(canTransitionProject("pending_approval", "cancelled")).toBe(false);
    expect(isGovernedProjectStatus("cancelled")).toBe(true);
  });

  it("approved → active and on_hold are allowed", () => {
    expect(canTransitionProject("approved", "active")).toBe(true);
    expect(canTransitionProject("approved", "on_hold")).toBe(true);
  });

  it("active → completed is allowed; completed is terminal", () => {
    expect(canTransitionProject("active", "completed")).toBe(true);
    expect(canTransitionProject("completed", "active")).toBe(false);
    expect(canTransitionProject("completed", "cancelled")).toBe(false);
  });

  it("cancelled is terminal", () => {
    expect(canTransitionProject("cancelled", "active")).toBe(false);
    expect(canTransitionProject("cancelled", "completed")).toBe(false);
  });

  it("status enum is complete", () => {
    expect([...PROJECT_STATUSES].sort()).toEqual(
      ["active", "approved", "cancelled", "completed", "on_hold", "pending_approval", "proposed"].sort()
    );
  });
});

describe("Ticket transition matrix", () => {
  it("open → triaged is allowed", () => {
    expect(canTransitionTicket("open", "triaged")).toBe(true);
  });

  it("triaged → in_progress is allowed", () => {
    expect(canTransitionTicket("triaged", "in_progress")).toBe(true);
  });

  it("in_progress → in_review and resolved are allowed", () => {
    expect(canTransitionTicket("in_progress", "in_review")).toBe(true);
    expect(canTransitionTicket("in_progress", "resolved")).toBe(true);
  });

  it("resolved → closed is governed (excluded from PATCH)", () => {
    expect(canTransitionTicket("resolved", "closed")).toBe(false);
    expect(isGovernedTicketStatus("closed")).toBe(true);
  });

  it("closed is terminal", () => {
    expect(canTransitionTicket("closed", "open")).toBe(false);
    expect(canTransitionTicket("closed", "resolved")).toBe(false);
  });

  it("ticket enums are complete", () => {
    expect([...TICKET_STATUSES].sort()).toEqual(
      ["closed", "in_progress", "in_review", "open", "resolved", "triaged"].sort()
    );
    expect([...TICKET_TYPES].sort()).toEqual(
      ["bug", "feature", "incident", "support", "task"].sort()
    );
    expect([...TICKET_PRIORITIES].sort()).toEqual(
      ["critical", "high", "low", "medium"].sort()
    );
  });
});

describe("Validators", () => {
  it("isValidProjectStatus / isValidTicketStatus accept valid, reject invalid", () => {
    expect(isValidProjectStatus("active")).toBe(true);
    expect(isValidProjectStatus("archived")).toBe(false);
    expect(isValidTicketStatus("open")).toBe(true);
    expect(isValidTicketStatus("archived")).toBe(false);
    expect(isValidTicketType("bug")).toBe(true);
    expect(isValidTicketType("epic")).toBe(false);
    expect(isValidTicketPriority("critical")).toBe(true);
    expect(isValidTicketPriority("urgent")).toBe(false);
    expect(isValidMilestoneStatus("missed")).toBe(true);
    expect(isValidMilestoneStatus("done")).toBe(false);
  });
});

describe("Over-allocation validator", () => {
  const base = { employeeId: "e1", startDate: "2026-11-01", endDate: "2026-12-31" };

  it("allows within capacity", () => {
    expect(checkOverAllocation([], { ...base, percentage: 60 }).ok).toBe(true);
  });

  it("rejects over capacity (overlapping)", () => {
    const existing = [
      { employeeId: "e1", percentage: 70, startDate: "2026-11-15", endDate: "2027-01-15" },
    ];
    const result = checkOverAllocation(existing, { ...base, percentage: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Over-allocated");
  });

  it("allows if no date overlap", () => {
    const existing = [
      { employeeId: "e1", percentage: 70, startDate: "2026-09-01", endDate: "2026-10-15" },
    ];
    expect(checkOverAllocation(existing, { ...base, percentage: 90 }).ok).toBe(true);
  });

  it("allows exactly 100%", () => {
    const existing = [
      { employeeId: "e1", percentage: 40, startDate: "2026-11-01", endDate: "2026-12-31" },
    ];
    expect(checkOverAllocation(existing, { ...base, percentage: 60 }).ok).toBe(true);
  });

  it("excludes self when excludeId matches", () => {
    const existing = [
      { id: "a1", employeeId: "e1", percentage: 80, startDate: "2026-11-01", endDate: "2026-12-31" },
    ];
    expect(checkOverAllocation(existing, { ...base, percentage: 80 }, "a1").ok).toBe(true);
  });
});

describe("Budget parsing (integer cents)", () => {
  it("parses whole and decimal amounts", () => {
    expect(parseBudgetToCents("100")).toBe(10000);
    expect(parseBudgetToCents("100.50")).toBe(10050);
    expect(parseBudgetToCents("100.5")).toBe(10050);
    expect(parseBudgetToCents("0.01")).toBe(1);
  });

  it("rejects invalid input", () => {
    expect(parseBudgetToCents("abc")).toBeNull();
    expect(parseBudgetToCents("1.234")).toBeNull();
    expect(parseBudgetToCents("-5")).toBeNull();
    expect(parseBudgetToCents("")).toBeNull();
  });

  it("isValidCents accepts non-negative integers", () => {
    expect(isValidCents(0)).toBe(true);
    expect(isValidCents(10050)).toBe(true);
    expect(isValidCents(-1)).toBe(false);
    expect(isValidCents(10.5)).toBe(false);
  });

  it("formatCents renders dollars", () => {
    expect(formatCents(45000000)).toBe("$450000.00");
    expect(formatCents(null)).toBe("—");
  });
});

describe("Permission catalog", () => {
  it("has all 11 project/ticket/allocation keys", () => {
    const keys = Object.values(PERMISSIONS);
    expect(keys).toContain("project.read");
    expect(keys).toContain("project.create");
    expect(keys).toContain("project.update");
    expect(keys).toContain("project.approve");
    expect(keys).toContain("ticket.read");
    expect(keys).toContain("ticket.create");
    expect(keys).toContain("ticket.update");
    expect(keys).toContain("ticket.close");
    expect(keys).toContain("allocation.read");
    expect(keys).toContain("allocation.create");
    expect(keys).toContain("allocation.update");
  });
});
