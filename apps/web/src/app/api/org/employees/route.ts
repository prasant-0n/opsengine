import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  closureFromRows,
  directoryScopeFilter,
  projectEmployee,
  RESTRICTED_EMPLOYEE_FIELDS,
  type EmployeeRow,
  type ViewerFacts,
} from "@/features/organization/lib/directory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const ctx = await buildAuthContext(token);
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Permission presence (RBAC) — scope enforced in the query below (PRD §3.4.6).
  const grants = ctx.permissions.filter((p) => p.key === PERMISSIONS.ORG_READ_DIRECTORY);
  if (grants.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let scope = directoryScopeFilter(ctx);
  if (scope.mode === "none") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = (searchParams.get("status") ?? "").trim();
  const department = (searchParams.get("department") ?? "").trim();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  // Tenant-scoped edges: reporting closure (list + viewer facts) and team member ids.
  const [edges, teamMemberships] = await Promise.all([
    prisma.reportingRelationship.findMany({
      where: {
        tenantId: ctx.tenantId,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      },
      select: { managerEmployeeId: true, reportEmployeeId: true, relationshipType: true },
    }),
    scope.mode === "team"
      ? prisma.employeeTeamMembership.findMany({
          where: { tenantId: ctx.tenantId, teamId: { in: scope.teamIds } },
          select: { employeeId: true },
        })
      : Promise.resolve([]),
  ]);

  if (scope.mode === "ids") {
    const closure = closureFromRows(ctx.employeeId ?? "", edges);
    scope = {
      mode: "ids",
      employeeIds: [...new Set([...closure, ...(ctx.employeeId ? [ctx.employeeId] : [])])],
    };
  }

  const where: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (scope.mode === "ids") {
    where.id = { in: scope.employeeIds };
  } else if (scope.mode === "team") {
    const memberIds = [...new Set(teamMemberships.map((m) => m.employeeId))];
    where.id = { in: memberIds };
  }
  if (status) where.employmentStatus = status;
  if (department) where.department = department;
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { employeeNumber: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.employee.count({ where }),
  ]);

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  const viewer: ViewerFacts = {
    employeeId: ctx.employeeId,
    closureIds: ctx.employeeId ? closureFromRows(ctx.employeeId, edges) : new Set<string>(),
    canManage: ctx.permissions.some(
      (p) => p.key === PERMISSIONS.ORG_MANAGE_EMPLOYEES && p.scopeType === "TENANT",
    ),
  };

  const employees = pageRows.map((row) => {
    const projected = projectEmployee(row as unknown as EmployeeRow, viewer);
    return {
      ...projected,
      id: row.id,
      displayName: row.displayName,
      employmentStatus: row.employmentStatus,
      // coordinator hints: only these booleans, not membership rows
      isSelf: row.id === ctx.employeeId,
    };
  });

  return NextResponse.json({
    employees,
    page,
    pageSize,
    total,
    hasMore,
    restrictedFields: [...RESTRICTED_EMPLOYEE_FIELDS],
  });
}
