import { describe, it, expect } from "vitest";
import {
  SUBJECT_TYPES,
  RESOLVER_TYPES,
  validateWorkflowRules,
  isStepSkipped,
  resolveApprovers,
  applyDelegations,
  isSelfApproval,
  canWithdraw,
  canDecideInstance,
  nextStateAfterDecision,
  isInstanceOverdue,
  isKnownSubjectType,
  describeRules,
  type StepRule,
  type ResolverInputs,
} from "../features/approvals/lib/approvals";

const now = new Date("2026-10-20T12:00:00Z");

function inputs(over: Partial<ResolverInputs> = {}): ResolverInputs {
  return {
    tenantId: "T",
    requesterEmployeeId: "emp-req",
    employees: [
      { id: "emp-req", employmentStatus: "active" },
      { id: "emp-mgr", employmentStatus: "active" },
      { id: "emp-skip", employmentStatus: "active" },
      { id: "emp-lead", employmentStatus: "active" },
      { id: "emp-inactive", employmentStatus: "inactive" },
      { id: "emp-hr", employmentStatus: "active" },
    ],
    relationships: [
      { managerEmployeeId: "emp-mgr", reportEmployeeId: "emp-req", validFrom: new Date("2026-01-01"), validTo: null },
      { managerEmployeeId: "emp-skip", reportEmployeeId: "emp-mgr", validFrom: new Date("2026-01-01"), validTo: null },
      { managerEmployeeId: "emp-inactive", reportEmployeeId: "emp-lead", validFrom: new Date("2026-01-01"), validTo: null },
    ],
    roleGrants: [
      { roleKey: "hr", principalEmployeeId: "emp-hr", validFrom: new Date("2026-01-01"), validTo: null },
      { roleKey: "hr", principalEmployeeId: "emp-inactive", validFrom: new Date("2026-01-01"), validTo: null },
      { roleKey: "hr", principalEmployeeId: "emp-hr", validFrom: new Date("2027-01-01"), validTo: null },
    ],
    permissionGrants: [
      { permissionKey: "approval.decide", principalEmployeeId: "emp-lead", validFrom: new Date("2026-01-01"), validTo: null },
      { permissionKey: "approval.decide", principalEmployeeId: "emp-hr", validFrom: new Date("2026-01-01"), validTo: new Date("2026-06-01") },
    ],
    now,
    ...over,
  };
}

describe("approval catalog", () => {
  it("exposes known subject types and resolvers", () => {
    expect(SUBJECT_TYPES).toContain("allocation");
    expect(RESOLVER_TYPES).toContain("REPORTING_TREE_OF_REQUESTER");
    expect(isKnownSubjectType("ticket")).toBe(true);
    expect(isKnownSubjectType("nope")).toBe(false);
  });
});

describe("validateWorkflowRules", () => {
  it("accepts a well-formed rule set", () => {
    const r = validateWorkflowRules({
      steps: [
        { stepNumber: 1, name: "Manager", mode: "any", resolver: { type: "REPORTING_MANAGER_OF_REQUESTER" }, minApprovals: 1 },
        { stepNumber: 2, name: "Lead", mode: "all", resolver: { type: "ROLE", role: "senior_lead" }, minApprovals: 2, amountThresholdCents: 500000 },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.value?.steps).toHaveLength(2);
  });

  it("rejects unknown keys", () => {
    const r = validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1, hack: 1 }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("unknown key 'hack'");
  });

  it("rejects unknown resolver types and modes", () => {
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "maybe", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1 }] }).ok).toBe(false);
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "SCRIPT" }, minApprovals: 1 }] }).ok).toBe(false);
  });

  it("rejects negative / non-integer thresholds and minApprovals", () => {
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 0 }] }).ok).toBe(false);
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1, amountThresholdCents: -5 }] }).ok).toBe(false);
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1, amountThresholdCents: 1.5 }] }).ok).toBe(false);
  });

  it("rejects executable-looking strings (never code)", () => {
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "eval(1)", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1 }] }).ok).toBe(false);
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "ROLE", role: "hr)||1" }, minApprovals: 1 }] }).ok).toBe(false);
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "PERMISSION", permission: "{{a}}" }, minApprovals: 1 }] }).ok).toBe(false);
  });

  it("rejects non-contiguous / duplicate step numbers and empty steps", () => {
    expect(validateWorkflowRules({ steps: [] }).ok).toBe(false);
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "a", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1 }, { stepNumber: 3, name: "b", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1 }] }).ok).toBe(false);
  });

  it("requires resolver-specific fields", () => {
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "ROLE" }, minApprovals: 1 }] }).ok).toBe(false);
    expect(validateWorkflowRules({ steps: [{ stepNumber: 1, name: "x", mode: "any", resolver: { type: "NAMED_EMPLOYEE" }, minApprovals: 1 }] }).ok).toBe(false);
  });
});

describe("isStepSkipped", () => {
  it("skips below-threshold steps", () => {
    expect(isStepSkipped(1000, 2000)).toBe(true);
    expect(isStepSkipped(2000, 2000)).toBe(false);
    expect(isStepSkipped(null, 2000)).toBe(false);
    expect(isStepSkipped(5000, null)).toBe(false);
  });
});

describe("resolveApprovers", () => {
  const base = inputs();
  it("resolves ROLE (active, time-windowed only)", () => {
    const rule: StepRule = { stepNumber: 1, name: "hr", mode: "any", resolver: { type: "ROLE", role: "hr" }, minApprovals: 1 };
    const out = resolveApprovers(rule, base);
    expect(out).toContain("emp-hr");
    expect(out).not.toContain("emp-inactive");
  });

  it("resolves REPORTING_MANAGER_OF_REQUESTER", () => {
    const rule: StepRule = { stepNumber: 1, name: "mgr", mode: "any", resolver: { type: "REPORTING_MANAGER_OF_REQUESTER" }, minApprovals: 1 };
    expect(resolveApprovers(rule, base)).toEqual(["emp-mgr"]);
  });

  it("resolves the whole REPORTING_TREE_OF_REQUESTER", () => {
    const rule: StepRule = { stepNumber: 1, name: "tree", mode: "any", resolver: { type: "REPORTING_TREE_OF_REQUESTER" }, minApprovals: 1 };
    const out = resolveApprovers(rule, base);
    expect(out).toContain("emp-mgr");
    expect(out).toContain("emp-skip");
  });

  it("resolves NAMED_EMPLOYEE only when active", () => {
    const ok: StepRule = { stepNumber: 1, name: "n", mode: "any", resolver: { type: "NAMED_EMPLOYEE", employeeId: "emp-lead" }, minApprovals: 1 };
    expect(resolveApprovers(ok, base)).toEqual(["emp-lead"]);
    const inactive: StepRule = { stepNumber: 1, name: "n", mode: "any", resolver: { type: "NAMED_EMPLOYEE", employeeId: "emp-inactive" }, minApprovals: 1 };
    expect(resolveApprovers(inactive, base)).toEqual([]);
  });

  it("resolves PERMISSION grantees within valid window", () => {
    const rule: StepRule = { stepNumber: 1, name: "p", mode: "any", resolver: { type: "PERMISSION", permission: "approval.decide" }, minApprovals: 1 };
    const out = resolveApprovers(rule, base);
    expect(out).toContain("emp-lead");
    expect(out).not.toContain("emp-hr"); // grant expired 2026-06-01
  });
});

describe("applyDelegations", () => {
  it("adds active in-window delegates and ignores expired/out-of-scope", () => {
    const out = applyDelegations(["A"], "allocation", "DEF1", [
      { fromEmployeeId: "A", toEmployeeId: "B", scopeType: "ALL", scopeValue: null, startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31"), active: true },
      { fromEmployeeId: "A", toEmployeeId: "C", scopeType: "ALL", scopeValue: null, startDate: new Date("2026-10-01"), endDate: new Date("2026-10-10"), active: true },
      { fromEmployeeId: "A", toEmployeeId: "D", scopeType: "SUBJECT_TYPE", scopeValue: "ticket", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31"), active: true },
      { fromEmployeeId: "A", toEmployeeId: "E", scopeType: "ALL", scopeValue: null, startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31"), active: false },
      { fromEmployeeId: "X", toEmployeeId: "F", scopeType: "ALL", scopeValue: null, startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31"), active: true },
    ], now);
    expect(out).toContain("A");
    expect(out).toContain("B");
    expect(out).not.toContain("C");
    expect(out).not.toContain("D");
    expect(out).not.toContain("E");
    expect(out).not.toContain("F");
  });
});

describe("engine decisions", () => {
  it("detects self-approval", () => {
    expect(isSelfApproval("e1", "e1")).toBe(true);
    expect(isSelfApproval("e1", "e2")).toBe(false);
    expect(isSelfApproval("e1", null)).toBe(false);
  });

  it("allows withdraw only by requester while pending", () => {
    expect(canWithdraw("pending", "e1", "e1")).toBe(true);
    expect(canWithdraw("pending", "e1", "e2")).toBe(false);
    expect(canWithdraw("approved", "e1", "e1")).toBe(false);
  });

  it("allows decide only for resolved approvers on a pending step", () => {
    expect(canDecideInstance("pending", "pending", ["e1"], "e1")).toBe(true);
    expect(canDecideInstance("pending", "pending", ["e1"], "e2")).toBe(false);
    expect(canDecideInstance("pending", "approved", ["e1"], "e1")).toBe(false);
    expect(canDecideInstance("rejected", "pending", ["e1"], "e1")).toBe(false);
  });

  it("advances multi-step, completes on last, rejects on reject", () => {
    expect(nextStateAfterDecision("approve", "any", 1, 1, true)).toMatchObject({ instanceStatus: "pending", advance: true });
    expect(nextStateAfterDecision("approve", "any", 1, 1, false)).toMatchObject({ instanceStatus: "approved", advance: false });
    expect(nextStateAfterDecision("approve", "all", 1, 2, false)).toMatchObject({ instanceStatus: "pending", stepStatus: "pending", advance: false });
    expect(nextStateAfterDecision("reject", "any", 1, 1, true)).toMatchObject({ instanceStatus: "rejected", stepStatus: "rejected" });
    expect(nextStateAfterDecision("request_changes", "any", 1, 1, true)).toMatchObject({ instanceStatus: "rejected" });
  });

  it("flags overdue only for pending instances", () => {
    expect(isInstanceOverdue(new Date("2026-10-19"), "pending", now)).toBe(true);
    expect(isInstanceOverdue(new Date("2026-10-25"), "pending", now)).toBe(false);
    expect(isInstanceOverdue(new Date("2026-10-19"), "approved", now)).toBe(false);
    expect(isInstanceOverdue(null, "pending", now)).toBe(false);
  });
});

describe("describeRules", () => {
  it("summarizes each step", () => {
    const lines = describeRules({
      steps: [
        { stepNumber: 1, name: "Mgr", mode: "any", resolver: { type: "REPORTING_MANAGER_OF_REQUESTER" }, minApprovals: 1 },
        { stepNumber: 2, name: "Lead", mode: "all", resolver: { type: "ROLE", role: "senior_lead" }, minApprovals: 1, amountThresholdCents: 500000 },
      ],
    });
    expect(lines[0]).toContain("reporting manager");
    expect(lines[1]).toContain("role:senior_lead");
    expect(lines[1]).toContain("500000");
  });
});
