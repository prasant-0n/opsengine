import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONTEXT_TTL_MS = 60_000; // fail closed beyond 60s per PRD §3.4.6

export type ScopeType =
  | "SELF"
  | "TEAM"
  | "REPORTING_TREE"
  | "SBU"
  | "PROJECT"
  | "GROUP"
  | "ASSIGNED_CASE"
  | "TENANT";

export interface PermissionEntry {
  key: string;
  scopeType: ScopeType;
  scopeId: string | null;
  validTo: Date | null;
}

export interface AuthorizationContext {
  tenantId: string;
  userId: string;
  employeeId: string | null;
  membershipStatus: "active" | "suspended" | "left";
  assurance: { mfa: boolean };
  permissions: PermissionEntry[];
  roles: Array<{ key: string; scopeType: ScopeType; scopeId: string | null }>;
  teamMemberships: Array<{
    teamId: string;
    responsibility: string;
    validTo: Date | null;
  }>;
  reporting: { managerIds: string[]; reportIds: string[] };
  accessGroupIds: string[];
  policyVersion: number;
  builtAt: number;
}

const cache = new Map<string, { ctx: AuthorizationContext; gen: number }>();
const generations = new Map<string, number>();

export function invalidateAuthContext(tenantId: string, userId?: string) {
  const key = `${tenantId}:${userId ?? "*"}`;
  generations.set(key, (generations.get(key) ?? 0) + 1);
  if (userId) {
    cache.delete(`${tenantId}:${userId}`);
  } else {
    for (const k of cache.keys()) {
      if (k.startsWith(`${tenantId}:`)) cache.delete(k);
    }
  }
}

function currentGen(tenantId: string, userId: string): number {
  return Math.max(
    generations.get(`${tenantId}:${userId}`) ?? 0,
    generations.get(`${tenantId}:*`) ?? 0,
  );
}

export async function buildAuthContext(
  sessionToken: string,
): Promise<AuthorizationContext | null> {
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  const { tenantId, userId } = session;
  const gen = currentGen(tenantId, userId);
  const cached = cache.get(`${tenantId}:${userId}`);
  if (
    cached &&
    cached.gen === gen &&
    Date.now() - cached.ctx.builtAt < CONTEXT_TTL_MS
  ) {
    return cached.ctx;
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!membership || membership.status !== "active") {
    return null;
  }

  const employee = membership.employeeId
    ? await prisma.employee.findFirst({
        where: { id: membership.employeeId, tenantId },
      })
    : await prisma.employee.findFirst({ where: { tenantId, userId } });

  const now = new Date();

  const [roleGrants, permissionGrants, teamMemberships, reportRows, groupMemberships, policy] =
    await Promise.all([
      prisma.roleGrant.findMany({
        where: {
          tenantId,
          principalUserId: userId,
          OR: [{ validTo: null }, { validTo: { gt: now } }],
          validFrom: { lte: now },
        },
      }),
      prisma.permissionGrant.findMany({
        where: {
          tenantId,
          principalUserId: userId,
          OR: [{ validTo: null }, { validTo: { gt: now } }],
          validFrom: { lte: now },
        },
      }),
      employee
        ? prisma.employeeTeamMembership.findMany({
            where: {
              tenantId,
              employeeId: employee.id,
              validFrom: { lte: now },
              OR: [{ validTo: null }, { validTo: { gt: now } }],
            },
          })
        : Promise.resolve([]),
      employee
        ? prisma.reportingRelationship.findMany({
            where: {
              tenantId,
              OR: [
                { managerEmployeeId: employee.id },
                { reportEmployeeId: employee.id },
              ],
            },
          })
        : Promise.resolve([]),
      employee
        ? prisma.accessGroupMembership.findMany({
            where: {
              tenantId,
              employeeId: employee.id,
              validFrom: { lte: now },
              OR: [{ validTo: null }, { validTo: { gt: now } }],
            },
          })
        : Promise.resolve([]),
      prisma.policyVersion.findFirst({ where: { tenantId, active: true } }),
    ]);

  const activeReporting = reportRows.filter(
    (r) => r.validFrom <= now && (!r.validTo || r.validTo > now),
  );

  const ctx: AuthorizationContext = {
    tenantId,
    userId,
    employeeId: employee?.id ?? null,
    membershipStatus: membership.status as "active" | "suspended" | "left",
    assurance: { mfa: false },
    permissions: permissionGrants.map((g) => ({
      key: g.permissionKey,
      scopeType: g.scopeType as ScopeType,
      scopeId: g.scopeId,
      validTo: g.validTo,
    })),
    roles: roleGrants.map((g) => ({
      key: g.roleKey,
      scopeType: g.scopeType as ScopeType,
      scopeId: g.scopeId,
    })),
    teamMemberships: teamMemberships.map((t) => ({
      teamId: t.teamId,
      responsibility: t.responsibility,
      validTo: t.validTo,
    })),
    reporting: {
      managerIds: activeReporting
        .filter((r) => r.reportEmployeeId === employee?.id)
        .map((r) => r.managerEmployeeId),
      reportIds: activeReporting
        .filter((r) => r.managerEmployeeId === employee?.id)
        .map((r) => r.reportEmployeeId),
    },
    accessGroupIds: groupMemberships.map((g) => g.groupId),
    policyVersion: policy?.version ?? 1,
    builtAt: Date.now(),
  };

  cache.set(`${tenantId}:${userId}`, { ctx, gen });
  return ctx;
}
