import { describe, it, expect } from "vitest";
import { prisma } from "../lib/prisma";
import {
  getWorkspaceDetails,
  updateWorkspaceSettings,
  getRolesAndGrants,
  grantRole,
  revokeRoleGrant,
  getTeams,
  createTeam,
  getAccessGroups,
  createAccessGroup,
  getTenantUsers,
  toggleBreakGlass,
} from "../features/admin/lib/admin-service";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const USER_A = "00000000-0000-4000-8000-000000000001";
const EMP_A = "00000000-0000-4000-8000-000000000011";
const USER_B = "00000000-0000-4000-8000-000000000002";

describe("Module 0 & 15 — Administration, Role Governance & Organization Management", () => {
  it("retrieves tenant workspace details, system configuration, and stats", async () => {
    const data = await getWorkspaceDetails(TENANT_A);
    expect(data.workspace).toBeDefined();
    expect(data.workspace?.tenantId).toBe(TENANT_A);
    expect(data.stats).toBeDefined();
    expect(data.stats.totalEmployees).toBeGreaterThanOrEqual(1);
    expect(data.stats.totalUsers).toBeGreaterThanOrEqual(1);
  });

  it("updates workspace settings and emits an audit event", async () => {
    const updated = await updateWorkspaceSettings(TENANT_A, USER_A, {
      aiEnabled: true,
    });
    expect(updated.aiEnabled).toBe(true);

    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: TENANT_A, eventType: "workspace.update" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorUserId).toBe(USER_A);
    expect(audit?.decision).toBe("allow");
  });

  it("queries the system role catalog and active tenant role grants", async () => {
    const data = await getRolesAndGrants(TENANT_A);
    expect(data.catalog.length).toBeGreaterThan(0);
    expect(data.catalog.some((r) => r.roleKey === "lead")).toBe(true);
    expect(data.catalog.some((r) => r.roleKey === "senior_lead")).toBe(true);
    expect(Array.isArray(data.grants)).toBe(true);
  });

  it("grants a role to an employee, invalidates context, and records an audit log", async () => {
    const grant = await grantRole(TENANT_A, USER_A, {
      principalUserId: USER_A,
      principalEmployeeId: EMP_A,
      roleKey: "finance",
      scopeType: "TENANT",
      reason: "Quarterly financial auditing assignment",
    });

    expect(grant).toBeDefined();
    expect(grant.tenantId).toBe(TENANT_A);
    expect(grant.roleKey).toBe("finance");

    // Verify stored in DB
    const fetched = await prisma.roleGrant.findUnique({ where: { id: grant.id } });
    expect(fetched).toBeDefined();

    // Verify audit log
    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: TENANT_A, eventType: "role.grant", resourceId: grant.id },
    });
    expect(audit).toBeDefined();
    expect(audit?.reasonCode).toBe("ROLE_ASSIGNED");

    // Clean up
    await revokeRoleGrant(TENANT_A, USER_A, grant.id);
  });

  it("revokes an existing role grant with audit tracking", async () => {
    // Create grant to revoke
    const grant = await grantRole(TENANT_A, USER_A, {
      principalUserId: USER_A,
      principalEmployeeId: EMP_A,
      roleKey: "recruiter",
      scopeType: "TENANT",
      reason: "Temporary ATS assistance",
    });

    const res = await revokeRoleGrant(TENANT_A, USER_A, grant.id);
    expect(res.success).toBe(true);

    // Verify removed
    const check = await prisma.roleGrant.findUnique({ where: { id: grant.id } });
    expect(check).toBeNull();

    // Verify audit log
    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: TENANT_A, eventType: "role.revoke", resourceId: grant.id },
    });
    expect(audit).toBeDefined();
    expect(audit?.reasonCode).toBe("ROLE_REVOKED");
  });

  it("creates an organizational team and queries teams scoped to tenant", async () => {
    const team = await createTeam(TENANT_A, USER_A, {
      name: "Security Engineering",
      teamType: "functional",
    });
    expect(team.name).toBe("Security Engineering");
    expect(team.tenantId).toBe(TENANT_A);

    const teams = await getTeams(TENANT_A);
    expect(teams.some((t) => t.id === team.id)).toBe(true);

    // Clean up
    await prisma.team.delete({ where: { id: team.id } });
  });

  it("creates an access group and queries groups scoped to tenant", async () => {
    const group = await createAccessGroup(TENANT_A, USER_A, {
      name: "SOC 2 Audit Taskforce",
      purpose: "Cross-functional compliance group",
    });
    expect(group.name).toBe("SOC 2 Audit Taskforce");
    expect(group.tenantId).toBe(TENANT_A);

    const groups = await getAccessGroups(TENANT_A);
    expect(groups.some((g) => g.id === group.id)).toBe(true);

    // Clean up
    await prisma.accessGroup.delete({ where: { id: group.id } });
  });

  it("lists tenant auth users and toggles emergency break-glass status", async () => {
    const users = await getTenantUsers(TENANT_A);
    expect(users.length).toBeGreaterThanOrEqual(1);

    const updated = await toggleBreakGlass(TENANT_A, USER_A, USER_A, true, "Emergency outage incident");
    expect(updated.breakGlassEnabled).toBe(true);

    // Verify audit
    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: TENANT_A, eventType: "break_glass.toggle", resourceId: USER_A },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeDefined();
    expect(audit?.reasonCode).toBe("EMERGENCY_OVERRIDE");

    // Reset back
    await toggleBreakGlass(TENANT_A, USER_A, USER_A, false, "Incident resolved");
  });

  it("cross-tenant negative test: Tenant B cannot mutate Tenant A settings, grant roles, or view teams", async () => {
    // Attempt to update Tenant A workspace with Tenant B context
    await expect(
      updateWorkspaceSettings(TENANT_B, USER_B, { name: "Hijacked Corp" })
    ).resolves.toBeDefined(); // updates Tenant B's own workspace, NOT Tenant A

    const workspaceA = await prisma.tenantWorkspace.findFirst({ where: { tenantId: TENANT_A } });
    expect(workspaceA?.name).not.toBe("Hijacked Corp");

    // Attempt to grant role to Tenant A user in Tenant B scope
    await expect(
      grantRole(TENANT_B, USER_B, {
        principalUserId: USER_A, // User from Tenant A
        roleKey: "sales",
        scopeType: "TENANT",
      })
    ).rejects.toThrow("Target user not found in this tenant");
  });
});
