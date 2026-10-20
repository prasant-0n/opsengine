import { describe, it, expect } from "vitest";
import { authorize, visibleFields, PERMISSIONS } from "../lib/permissions";
import type { AuthorizationContext } from "../lib/permissions";

function ctx(base: Partial<AuthorizationContext>): AuthorizationContext {
  const now = Date.now();
  return {
    tenantId: "00000000-0000-0000-0000-000000000001",
    userId: "00000000-0000-0000-0000-000000000010",
    employeeId: "00000000-0000-0000-0000-000000000020",
    membershipStatus: "active",
    assurance: { mfa: false },
    permissions: [],
    roles: [],
    teamMemberships: [],
    reporting: { managerIds: [], reportIds: [] },
    accessGroupIds: [],
    policyVersion: 1,
    builtAt: now,
    ...base,
  };
}

describe("authz engine — deny by default", () => {
  it("denies when no permission", () => {
    const c = ctx({});
    const d = authorize(c, PERMISSIONS.WORK_TICKET_ASSIGN, {
      tenantId: c.tenantId,
    });
    expect(d.allowed).toBe(false);
    expect(d.reasonCode).toBe("NO_PERMISSION");
  });

  it("allows SELF scope when owning employee matches", () => {
    const c = ctx({
      permissions: [
        {
          key: PERMISSIONS.PROFILE_READ_SELF,
          scopeType: "SELF",
          scopeId: null,
          validTo: null,
        },
      ],
    });
    const d = authorize(c, PERMISSIONS.PROFILE_READ_SELF, {
      tenantId: c.tenantId,
      owningEmployeeId: c.employeeId,
    });
    expect(d.allowed).toBe(true);
    expect(d.matchedScope?.type).toBe("SELF");
  });

  it("denies SELF scope when different employee", () => {
    const c = ctx({
      permissions: [
        {
          key: PERMISSIONS.PROFILE_READ_SELF,
          scopeType: "SELF",
          scopeId: null,
          validTo: null,
        },
      ],
    });
    const d = authorize(c, PERMISSIONS.PROFILE_READ_SELF, {
      tenantId: c.tenantId,
      owningEmployeeId: "00000000-0000-0000-0000-000000000099",
    });
    expect(d.allowed).toBe(false);
    expect(d.reasonCode).toBe("NO_SCOPE");
  });

  it("denies tenant mismatch", () => {
    const c = ctx({
      permissions: [
        {
          key: PERMISSIONS.PROFILE_READ_SELF,
          scopeType: "SELF",
          scopeId: null,
          validTo: null,
        },
      ],
    });
    const d = authorize(c, PERMISSIONS.PROFILE_READ_SELF, {
      tenantId: "00000000-0000-0000-0000-000000000002",
      owningEmployeeId: c.employeeId,
    });
    expect(d.allowed).toBe(false);
    expect(d.reasonCode).toBe("TENANT_MISMATCH");
  });

  it("blocks self-approval under SoD", () => {
    const c = ctx({
      permissions: [
        {
          key: "release.business_signoff",
          scopeType: "TENANT",
          scopeId: null,
          validTo: null,
        },
      ],
    });
    const d = authorize(c, "release.business_signoff", {
      tenantId: c.tenantId,
      requesterEmployeeId: c.employeeId,
    });
    expect(d.allowed).toBe(false);
    expect(d.reasonCode).toBe("SOD_SELF_APPROVAL");
  });

  it("allows self-approval with sod.override", () => {
    const c = ctx({
      permissions: [
        {
          key: "release.business_signoff",
          scopeType: "TENANT",
          scopeId: null,
          validTo: null,
        },
        {
          key: PERMISSIONS.SOD_OVERRIDE,
          scopeType: "TENANT",
          scopeId: null,
          validTo: null,
        },
      ],
    });
    const d = authorize(c, "release.business_signoff", {
      tenantId: c.tenantId,
      requesterEmployeeId: c.employeeId,
    });
    expect(d.allowed).toBe(true);
  });

  it("redacts sensitive fields by default", () => {
    const c = ctx({});
    const out = visibleFields(c, { tenantId: c.tenantId }, {
      name: "Alice",
      salary: 100000,
    } as any, ["salary"]);
    expect(out.salary).toBeUndefined();
    expect(out.name).toBe("Alice");
  });
});
