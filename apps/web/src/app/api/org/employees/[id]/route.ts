import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, writeAudit } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  closureFromRows,
  projectEmployee,
  validateEmployeePatch,
  RESTRICTED_EMPLOYEE_FIELDS,
  type EmployeeRow,
  type ViewerFacts,
} from "@/features/organization/lib/directory";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function loadContext() {
  const token = await getSessionToken();
  if (!token) return null;
  return buildAuthContext(token);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await loadContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Tenant predicate first: cross-tenant / unknown id → 404 (no existence leak).
  const row = await prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();

  const [edges, rowTeamMemberships] = await Promise.all([
    prisma.reportingRelationship.findMany({
      where: {
        tenantId: ctx.tenantId,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      },
      select: { managerEmployeeId: true, reportEmployeeId: true, relationshipType: true },
    }),
    prisma.employeeTeamMembership.findMany({
      where: { tenantId: ctx.tenantId, employeeId: row.id },
      select: { teamId: true },
    }),
  ]);

  const isSelf = ctx.employeeId === row.id;
  if (isSelf) {
    // Self-read falls back to profile.read_self (PRD §3.4.5); deny-by-default.
    const canReadSelf = ctx.permissions.some(
      (p) => p.key === PERMISSIONS.PROFILE_READ_SELF,
    );
    if (!canReadSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const authz = authorize(
      ctx,
      PERMISSIONS.ORG_READ_DIRECTORY,
      {
        tenantId: row.tenantId,
        resourceType: "employee",
        id: row.id,
        owningEmployeeId: row.id,
        teamIds: rowTeamMemberships.map((m) => m.teamId),
        sbuId: row.sbuId,
      },
      { audit: true },
    );
    if (!authz.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const viewer: ViewerFacts = {
    employeeId: ctx.employeeId,
    closureIds: ctx.employeeId ? closureFromRows(ctx.employeeId, edges) : new Set<string>(),
    canManage: ctx.permissions.some(
      (p) => p.key === PERMISSIONS.ORG_MANAGE_EMPLOYEES && p.scopeType === "TENANT",
    ),
  };

  const projected = projectEmployee(row as unknown as EmployeeRow, viewer);
  const redactedFields = RESTRICTED_EMPLOYEE_FIELDS.filter(
    (k) => row[k] != null && projected[k] == null,
  );
  return NextResponse.json({ employee: projected, redactedFields });
}

const PATCHABLE_AUDIT_KEYS = new Set([
  "jobTitle",
  "jobFamily",
  "grade",
  "seniority",
  "department",
  "employmentType",
  "location",
  "employmentStatus",
  "probationEndsAt",
  "employeeNumber",
  "displayName",
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await loadContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const row = await prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();

  const authz = authorize(
    ctx,
    PERMISSIONS.ORG_MANAGE_EMPLOYEES,
    {
      tenantId: row.tenantId,
      resourceType: "employee",
      id: row.id,
      owningEmployeeId: row.id,
    },
    { audit: true },
  );
  if (!authz.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = validateEmployeePatch(body);
  if (!patch.ok || !patch.data) {
    return NextResponse.json({ error: patch.error ?? "Invalid patch" }, { status: 400 });
  }

  const updated = await prisma.employee.update({
    where: { id: row.id },
    data: patch.data as Record<string, unknown>,
  });

  writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    eventType: "hr.employee.update",
    resourceType: "employee",
    resourceId: row.id,
    decision: "allow",
    reasonCode: "ORG_MANAGE_EMPLOYEES",
    policyVersion: ctx.policyVersion,
    metadata: {
      changed: Object.keys(patch.data).filter((k) => PATCHABLE_AUDIT_KEYS.has(k)),
    },
  });

  const [edges] = await Promise.all([
    prisma.reportingRelationship.findMany({
      where: {
        tenantId: ctx.tenantId,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      },
      select: { managerEmployeeId: true, reportEmployeeId: true, relationshipType: true },
    }),
  ]);
  const viewer: ViewerFacts = {
    employeeId: ctx.employeeId,
    closureIds: ctx.employeeId ? closureFromRows(ctx.employeeId, edges) : new Set<string>(),
    canManage: true,
  };

  return NextResponse.json({ employee: projectEmployee(updated as unknown as EmployeeRow, viewer) });
}
