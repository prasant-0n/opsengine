import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { checkOverAllocation } from "@/features/projects/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.ALLOCATION_READ, {
    tenantId: ctx.tenantId,
    resourceType: "allocation",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get("projectId") ?? "").trim();
  const employeeId = (searchParams.get("employeeId") ?? "").trim();

  const where: any = { tenantId: ctx.tenantId };
  if (projectId) where.projectId = projectId;
  if (employeeId) where.employeeId = employeeId;

  const rows = await prisma.allocation.findMany({ where, orderBy: { startDate: "asc" }, take: 200 });
  const empIds = Array.from(new Set(rows.map((r) => r.employeeId)));
  const projIds = Array.from(new Set(rows.map((r) => r.projectId)));
  const [emps, projs] = await Promise.all([
    empIds.length ? prisma.employee.findMany({ where: { id: { in: empIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } }) : [],
    projIds.length ? prisma.project.findMany({ where: { id: { in: projIds }, tenantId: ctx.tenantId }, select: { id: true, name: true, code: true } }) : [],
  ]);
  const empName = new Map(emps.map((e) => [e.id, e.displayName]));
  const projName = new Map(projs.map((p) => [p.id, `${p.code} · ${p.name}`]));

  const allocations = rows.map((r) => ({
    ...r,
    employeeName: empName.get(r.employeeId) ?? null,
    projectName: projName.get(r.projectId) ?? null,
  }));
  return NextResponse.json({ allocations });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.ALLOCATION_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "allocation",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  if (!body.employeeId) return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });
  const pct = parseInt(body.percentage, 10);
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) return NextResponse.json({ error: "percentage must be integer 1–100" }, { status: 400 });
  if (!body.startDate || !body.endDate) return NextResponse.json({ error: "Missing startDate/endDate" }, { status: 400 });
  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const [projOk, empOk] = await Promise.all([
    prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true, status: true } }),
    prisma.employee.findFirst({ where: { id: body.employeeId, tenantId: ctx.tenantId }, select: { id: true } }),
  ]);
  if (!projOk) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  if (!empOk) return NextResponse.json({ error: "Invalid employeeId" }, { status: 400 });

  // Over-allocation check
  const existing = await prisma.allocation.findMany({
    where: {
      tenantId: ctx.tenantId,
      employeeId: body.employeeId,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true, percentage: true, startDate: true, endDate: true },
  });
  const check = checkOverAllocation(existing, {
    employeeId: body.employeeId,
    percentage: pct,
    startDate: start,
    endDate: end,
  });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const allocation = await prisma.allocation.create({
    data: {
      tenantId: ctx.tenantId,
      projectId: body.projectId,
      employeeId: body.employeeId,
      percentage: pct,
      startDate: start,
      endDate: end,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json({ allocation }, { status: 201 });
}
