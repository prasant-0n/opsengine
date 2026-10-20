import { describe, it, expect } from "vitest";
import type { AuthorizationContext } from "../lib/permissions/context";
import {
  directoryScopeFilter,
  projectEmployee,
  closureFromRows,
  validateEmployeePatch,
  RESTRICTED_EMPLOYEE_FIELDS,
  type EmployeeRow,
  type ReportingEdge,
} from "../features/organization/lib/directory";

function makeCtx(overrides: Partial<AuthorizationContext>): AuthorizationContext {
  return {
    tenantId: "t1",
    userId: "u1",
    employeeId: "emp-self",
    membershipStatus: "active",
    assurance: { mfa: false },
    permissions: [],
    roles: [],
    teamMemberships: [],
    reporting: { managerIds: [], reportIds: [] },
    accessGroupIds: [],
    policyVersion: 1,
    builtAt: Date.now(),
    ...overrides,
  } as AuthorizationContext;
}

function dirGrant(scopeType: string, scopeId: string | null = null) {
  return { key: "org.read_directory", scopeType: scopeType as never, scopeId, validTo: null };
}

function makeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: "emp-1",
    tenantId: "t1",
    displayName: "Test Person",
    employeeNumber: "ACME-0002",
    workEmail: "test@acme.example",
    jobTitle: "Engineer",
    jobFamily: "Engineering",
    grade: "P3",
    seniority: "mid",
    department: "Engineering",
    sbuId: null,
    employmentType: "full_time",
    location: "Bengaluru",
    startDate: new Date("2023-01-01"),
    probationEndsAt: new Date("2026-12-31"),
    employmentStatus: "active",
    ...overrides,
  };
}

describe("directoryScopeFilter", () => {
  it("returns all for TENANT scope", () => {
    const ctx = makeCtx({ permissions: [dirGrant("TENANT") as never] });
    expect(directoryScopeFilter(ctx)).toEqual({ mode: "all" });
  });

  it("returns pinned team for TEAM scope with scopeId", () => {
    const ctx = makeCtx({ permissions: [dirGrant("TEAM", "team-9") as never] });
    expect(directoryScopeFilter(ctx)).toEqual({ mode: "team", teamIds: ["team-9"] });
  });

  it("unions subject teams when TEAM scope has no scopeId", () => {
    const ctx = makeCtx({
      permissions: [dirGrant("TEAM") as never],
      teamMemberships: [
        { teamId: "a", responsibility: "member", validTo: null },
        { teamId: "b", responsibility: "member", validTo: null },
      ],
    });
    const scope = directoryScopeFilter(ctx);
    expect(scope.mode).toBe("team");
    expect((scope as { teamIds: string[] }).teamIds.sort()).toEqual(["a", "b"]);
  });

  it("returns reporting closure + self for REPORTING_TREE scope", () => {
    const ctx = makeCtx({
      permissions: [dirGrant("REPORTING_TREE") as never],
      reporting: { managerIds: ["boss"], reportIds: ["r1", "r2"] },
    });
    const scope = directoryScopeFilter(ctx);
    expect(scope.mode).toBe("ids");
    expect((scope as { employeeIds: string[] }).employeeIds.sort()).toEqual([
      "emp-self",
      "r1",
      "r2",
    ]);
  });

  it("denies when no org.read_directory grant exists (deny by default)", () => {
    const ctx = makeCtx({ permissions: [] });
    expect(directoryScopeFilter(ctx)).toEqual({ mode: "none" });
  });

  it("SELF grant grants no directory visibility", () => {
    const ctx = makeCtx({ permissions: [dirGrant("SELF") as never] });
    expect(directoryScopeFilter(ctx)).toEqual({ mode: "none" });
  });

  it("TENANT wins over narrower grants", () => {
    const ctx = makeCtx({
      permissions: [dirGrant("TEAM", "t1"), dirGrant("TENANT") as never],
    });
    expect(directoryScopeFilter(ctx)).toEqual({ mode: "all" });
  });
});

describe("projectEmployee field projection", () => {
  const restricted = [...RESTRICTED_EMPLOYEE_FIELDS];

  it("viewer sees own restricted fields", () => {
    const row = makeRow({ id: "emp-1" });
    const out = projectEmployee(row, {
      employeeId: "emp-1",
      closureIds: new Set<string>(),
      canManage: false,
    });
    expect(out.workEmail).toBe(row.workEmail);
    expect(out.probationEndsAt).toBe(row.probationEndsAt);
  });

  it("manager (in downward closure) sees restricted fields", () => {
    const row = makeRow({ id: "report" });
    const out = projectEmployee(row, {
      employeeId: "manager",
      closureIds: new Set(["report", "grandchild"]),
      canManage: false,
    });
    expect(out.workEmail).toBe(row.workEmail);
  });

  it("HR manager with org.manage_employees sees restricted fields", () => {
    const row = makeRow({ id: "anyone" });
    const out = projectEmployee(row, {
      employeeId: "hr-user",
      closureIds: new Set<string>(),
      canManage: true,
    });
    expect(out.workEmail).toBe(row.workEmail);
  });

  it("peer loses restricted fields but keeps basic fields", () => {
    const row = makeRow({ id: "peer" });
    const out = projectEmployee(row, {
      employeeId: "me",
      closureIds: new Set<string>(),
      canManage: false,
    });
    for (const key of restricted) {
      expect(out[key as keyof EmployeeRow]).toBeNull();
    }
    expect(out.displayName).toBe(row.displayName);
    expect(out.jobTitle).toBe(row.jobTitle);
    expect(out.employmentStatus).toBe("active");
    expect(out.employeeNumber).toBe(row.employeeNumber);
  });

  it("only schema-backed restricted keys are redacted", () => {
    expect([...RESTRICTED_EMPLOYEE_FIELDS].sort()).toEqual(["probationEndsAt", "workEmail"]);
  });
});

describe("closureFromRows reporting traversal", () => {
  const edges: ReportingEdge[] = [
    { managerEmployeeId: "a", reportEmployeeId: "b", relationshipType: "direct" },
    { managerEmployeeId: "b", reportEmployeeId: "c", relationshipType: "direct" },
    { managerEmployeeId: "c", reportEmployeeId: "d", relationshipType: "direct" },
    { managerEmployeeId: "a", reportEmployeeId: "x", relationshipType: "dotted" },
  ];

  it("walks multi-level direct chain", () => {
    const out = closureFromRows("a", edges);
    expect([...out].sort()).toEqual(["b", "c", "d"]);
  });

  it("excludes dotted-line relationships from primary chain", () => {
    const out = closureFromRows("a", edges);
    expect(out.has("x")).toBe(false);
  });

  it("guards against cycles", () => {
    const cyclic: ReportingEdge[] = [
      { managerEmployeeId: "a", reportEmployeeId: "b", relationshipType: "direct" },
      { managerEmployeeId: "b", reportEmployeeId: "c", relationshipType: "direct" },
      { managerEmployeeId: "c", reportEmployeeId: "a", relationshipType: "direct" },
    ];
    const out = closureFromRows("a", cyclic);
    expect(out.has("a")).toBe(false); // root never re-added
    expect(out.size).toBe(2);
  });

  it("respects depth cap", () => {
    const deep: ReportingEdge[] = Array.from({ length: 20 }, (_, i) => ({
      managerEmployeeId: `e${i}`,
      reportEmployeeId: `e${i + 1}`,
      relationshipType: "direct",
    }));
    const out = closureFromRows("e0", deep, { maxDepth: 5 });
    expect(out.size).toBe(5);
  });

  it("empty edges returns empty set", () => {
    expect(closureFromRows("a", []).size).toBe(0);
  });
});

describe("validateEmployeePatch", () => {
  it("accepts a valid subset", () => {
    const res = validateEmployeePatch({ jobTitle: "Staff Engineer", employmentStatus: "notice" });
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ jobTitle: "Staff Engineer", employmentStatus: "notice" });
  });

  it("rejects unknown fields", () => {
    expect(validateEmployeePatch({ salary: 100 }).ok).toBe(false);
  });

  it("rejects invalid employment status", () => {
    const res = validateEmployeePatch({ employmentStatus: "zombie" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/employmentStatus/);
  });

  it("rejects non-string field values", () => {
    expect(validateEmployeePatch({ jobTitle: 42 }).ok).toBe(false);
  });

  it("rejects malformed probationEndsAt", () => {
    expect(validateEmployeePatch({ probationEndsAt: "not-a-date" }).ok).toBe(false);
  });

  it("rejects probation beyond 2 years", () => {
    const res = validateEmployeePatch({ probationEndsAt: "2035-01-01" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/2 years/);
  });

  it("accepts empty body? no — requires at least one valid field", () => {
    expect(validateEmployeePatch({}).ok).toBe(false);
  });

  it("rejects non-object bodies", () => {
    expect(validateEmployeePatch(null).ok).toBe(false);
    expect(validateEmployeePatch("x").ok).toBe(false);
    expect(validateEmployeePatch([]).ok).toBe(false);
  });
});
