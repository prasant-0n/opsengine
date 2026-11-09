import { prisma } from "@/lib/prisma";
import { writeAuditAsync } from "@/lib/permissions/audit";
import { invalidateAuthContext } from "@/lib/permissions/context";
import { ROLE_TEMPLATES } from "@/lib/permissions/permissions";

export interface WorkspaceSettingsUpdate {
  name?: string;
  domain?: string;
  aiEnabled?: boolean;
}

export interface GrantRoleInput {
  principalUserId: string;
  principalEmployeeId?: string | null;
  roleKey: string;
  scopeType: string;
  scopeId?: string | null;
  reason?: string | null;
}

export async function getWorkspaceDetails(tenantId: string) {
  const [workspace, totalEmployees, totalTeams, totalAccessGroups, totalUsers, roleGrantsCount] =
    await Promise.all([
      prisma.tenantWorkspace.findFirst({ where: { tenantId } }),
      prisma.employee.count({ where: { tenantId, employmentStatus: "active" } }),
      prisma.team.count({ where: { tenantId } }),
      prisma.accessGroup.count({ where: { tenantId } }),
      prisma.authUser.count({ where: { tenantId } }),
      prisma.roleGrant.count({
        where: {
          tenantId,
          OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
        },
      }),
    ]);

  return {
    workspace,
    stats: {
      totalEmployees,
      totalTeams,
      totalAccessGroups,
      totalUsers,
      roleGrantsCount,
    },
  };
}

export async function updateWorkspaceSettings(
  tenantId: string,
  actorUserId: string,
  update: WorkspaceSettingsUpdate
) {
  const existing = await prisma.tenantWorkspace.findFirst({ where: { tenantId } });
  if (!existing) {
    throw new Error("Tenant workspace not found");
  }

  const updated = await prisma.tenantWorkspace.update({
    where: { id: existing.id },
    data: {
      ...(update.name !== undefined ? { name: update.name } : {}),
      ...(update.domain !== undefined ? { domain: update.domain } : {}),
      ...(update.aiEnabled !== undefined ? { aiEnabled: update.aiEnabled } : {}),
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "workspace.update",
    resourceType: "tenant_workspace",
    resourceId: existing.id,
    decision: "allow",
    reasonCode: "ADMIN_UPDATE",
    metadata: { fields: Object.keys(update) },
  });

  return updated;
}

export async function getRolesAndGrants(tenantId: string) {
  const grants = await prisma.roleGrant.findMany({
    where: {
      tenantId,
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
    },
    orderBy: { validFrom: "desc" },
  });

  // Get user details for principals
  const userIds = Array.from(new Set(grants.map((g) => g.principalUserId)));
  const users = await prisma.authUser.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  // Get employee names if available
  const employeeIds = Array.from(
    new Set(grants.map((g) => g.principalEmployeeId).filter((id): id is string => Boolean(id)))
  );
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, tenantId },
    select: { id: true, displayName: true, jobTitle: true, department: true },
  });
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  const enrichedGrants = grants.map((g) => ({
    ...g,
    userEmail: userMap.get(g.principalUserId) || "unknown",
    employee: g.principalEmployeeId ? employeeMap.get(g.principalEmployeeId) || null : null,
  }));

  const roleCatalog = Object.entries(ROLE_TEMPLATES).map(([roleKey, perms]) => ({
    roleKey,
    permissionCount: perms.length,
    permissions: perms,
  }));

  return {
    catalog: roleCatalog,
    grants: enrichedGrants,
  };
}

export async function grantRole(
  tenantId: string,
  actorUserId: string,
  input: GrantRoleInput
) {
  const { principalUserId, principalEmployeeId, roleKey, scopeType, scopeId, reason } = input;

  // Verify principal user belongs to tenant
  const user = await prisma.authUser.findFirst({
    where: { id: principalUserId, tenantId },
  });
  if (!user) {
    throw new Error("Target user not found in this tenant");
  }

  const grant = await prisma.roleGrant.create({
    data: {
      tenantId,
      principalUserId,
      principalEmployeeId: principalEmployeeId || null,
      roleKey,
      scopeType,
      scopeId: scopeId || null,
      reason: reason || "Admin role assignment",
      grantedBy: actorUserId,
    },
  });

  // Invalidate cache
  invalidateAuthContext(tenantId, principalUserId);

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "role.grant",
    resourceType: "role_grant",
    resourceId: grant.id,
    decision: "allow",
    reasonCode: "ROLE_ASSIGNED",
    metadata: { roleKey, scopeType, targetUserId: principalUserId },
  });

  return grant;
}

export async function revokeRoleGrant(
  tenantId: string,
  actorUserId: string,
  grantId: string
) {
  const grant = await prisma.roleGrant.findFirst({
    where: { id: grantId, tenantId },
  });
  if (!grant) {
    throw new Error("Role grant not found");
  }

  await prisma.roleGrant.delete({
    where: { id: grant.id },
  });

  // Invalidate cache
  invalidateAuthContext(tenantId, grant.principalUserId);

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "role.revoke",
    resourceType: "role_grant",
    resourceId: grant.id,
    decision: "allow",
    reasonCode: "ROLE_REVOKED",
    metadata: { roleKey: grant.roleKey, targetUserId: grant.principalUserId },
  });

  return { success: true, revokedId: grantId };
}

export async function getTeams(tenantId: string) {
  return prisma.team.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
}

export async function createTeam(
  tenantId: string,
  actorUserId: string,
  data: { name: string; teamType?: string; sbuId?: string; parentTeamId?: string }
) {
  if (!data.name || !data.name.trim()) {
    throw new Error("Team name is required");
  }

  const team = await prisma.team.create({
    data: {
      tenantId,
      name: data.name.trim(),
      teamType: data.teamType || "functional",
      sbuId: data.sbuId || null,
      parentTeamId: data.parentTeamId || null,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "team.create",
    resourceType: "team",
    resourceId: team.id,
    decision: "allow",
    reasonCode: "TEAM_CREATED",
    metadata: { name: team.name, teamType: team.teamType },
  });

  return team;
}

export async function getAccessGroups(tenantId: string) {
  const groups = await prisma.accessGroup.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });

  const memberCounts = await prisma.accessGroupMembership.groupBy({
    by: ["groupId"],
    where: { tenantId },
    _count: { id: true },
  });
  const countMap = new Map(memberCounts.map((c) => [c.groupId, c._count.id]));

  return groups.map((g) => ({
    ...g,
    memberCount: countMap.get(g.id) || 0,
  }));
}

export async function createAccessGroup(
  tenantId: string,
  actorUserId: string,
  data: { name: string; purpose?: string }
) {
  if (!data.name || !data.name.trim()) {
    throw new Error("Access group name is required");
  }

  const group = await prisma.accessGroup.create({
    data: {
      tenantId,
      name: data.name.trim(),
      purpose: data.purpose || null,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "access_group.create",
    resourceType: "access_group",
    resourceId: group.id,
    decision: "allow",
    reasonCode: "ACCESS_GROUP_CREATED",
    metadata: { name: group.name },
  });

  return group;
}

export async function getTenantUsers(tenantId: string) {
  const users = await prisma.authUser.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      isRootAdmin: true,
      isSuperadmin: true,
      breakGlassEnabled: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Cross-reference with employees
  const employees = await prisma.employee.findMany({
    where: { tenantId },
    select: { id: true, userId: true, displayName: true, jobTitle: true, department: true },
  });
  const empMap = new Map(
    employees.filter((e) => e.userId).map((e) => [e.userId!, e])
  );

  return users.map((u) => ({
    ...u,
    employee: empMap.get(u.id) || null,
  }));
}

export async function toggleBreakGlass(
  tenantId: string,
  actorUserId: string,
  targetUserId: string,
  enabled: boolean,
  reason: string
) {
  const user = await prisma.authUser.findFirst({
    where: { id: targetUserId, tenantId },
  });
  if (!user) {
    throw new Error("Target user not found");
  }

  const updated = await prisma.authUser.update({
    where: { id: user.id },
    data: { breakGlassEnabled: enabled },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "break_glass.toggle",
    resourceType: "auth_user",
    resourceId: user.id,
    decision: "allow",
    reasonCode: "EMERGENCY_OVERRIDE",
    metadata: { enabled, targetEmail: user.email, reason },
  });

  return updated;
}
