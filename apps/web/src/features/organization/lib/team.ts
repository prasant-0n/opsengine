import type { AuthorizationContext } from "../../../lib/permissions/context";
import { prisma } from "../../../lib/prisma";

export interface MyTeamResult {
  employeeId: string | null;
  teams: Array<{ id: string; name: string; responsibility: string }>;
  directReports: Array<{
    id: string;
    displayName: string;
    jobTitle: string | null;
    department: string | null;
    employmentStatus: string;
    relationshipType: string;
  }>;
  teamMembers: Array<{
    id: string;
    displayName: string;
    jobTitle: string | null;
    department: string | null;
    employmentStatus: string;
  }>;
}

// Direct reports (active edges) + members of the viewer's active teams.
// Tenant-predicated on every query (PRD §3.4.6).
export async function myTeamQuery(ctx: AuthorizationContext): Promise<MyTeamResult> {
  const now = new Date();
  const empty: MyTeamResult = {
    employeeId: ctx.employeeId,
    teams: [],
    directReports: [],
    teamMembers: [],
  };
  if (!ctx.employeeId) return empty;

  const teamIds = ctx.teamMemberships.map((t) => t.teamId);

  const [reportRows, memberRows, memberships, teams] = await Promise.all([
    prisma.reportingRelationship.findMany({
      where: {
        tenantId: ctx.tenantId,
        managerEmployeeId: ctx.employeeId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
    }),
    teamIds.length > 0
      ? prisma.employeeTeamMembership.findMany({
          where: {
            tenantId: ctx.tenantId,
            teamId: { in: teamIds },
            employeeId: { not: ctx.employeeId },
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gt: now } }],
          },
        })
      : Promise.resolve([]),
    prisma.employeeTeamMembership.findMany({
      where: {
        tenantId: ctx.tenantId,
        employeeId: ctx.employeeId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
    }),
    prisma.team.findMany({
      where: { tenantId: ctx.tenantId, id: { in: teamIds } },
      orderBy: { name: "asc" },
    }),
  ]);

  const memberIds = [...new Set(memberRows.map((m) => m.employeeId))];
  const teamRows =
    memberIds.length > 0
      ? await prisma.employee.findMany({
          where: { tenantId: ctx.tenantId, id: { in: memberIds } },
          orderBy: { displayName: "asc" },
        })
      : [];

  const reportIds = reportRows.map((r) => r.reportEmployeeId);
  const reports =
    reportIds.length > 0
      ? prisma.employee.findMany({
          where: { tenantId: ctx.tenantId, id: { in: reportIds } },
          orderBy: { displayName: "asc" },
        })
      : Promise.resolve([]);
  const reportEmployees = await reports;
  const typeByReport = new Map(reportRows.map((r) => [r.reportEmployeeId, r.relationshipType]));

  const responsibilityByTeam = new Map(memberships.map((m) => [m.teamId, m.responsibility]));

  return {
    employeeId: ctx.employeeId,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      responsibility: responsibilityByTeam.get(t.id) ?? "member",
    })),
    directReports: reportEmployees.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      jobTitle: e.jobTitle,
      department: e.department,
      employmentStatus: e.employmentStatus,
      relationshipType: typeByReport.get(e.id) ?? "direct",
    })),
    teamMembers: teamRows.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      jobTitle: e.jobTitle,
      department: e.department,
      employmentStatus: e.employmentStatus,
    })),
  };
}
