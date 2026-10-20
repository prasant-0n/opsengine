import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { checkOverAllocation } from "@/features/projects/lib/projects";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.ALLOCATION_UPDATE, {
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

  const alloc = await prisma.allocation.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!alloc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  let pct = alloc.percentage;
  let start = alloc.startDate;
  let end = alloc.endDate;
  if (body.percentage !== undefined) {
    const p = parseInt(body.percentage, 10);
    if (!Number.isInteger(p) || p < 1 || p > 100) return NextResponse.json({ error: "percentage must be integer 1–100" }, { status: 400 });
    data.percentage = p;
    pct = p;
  }
  if (body.startDate !== undefined) {
    const d = new Date(body.startDate);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    data.startDate = d;
    start = d;
  }
  if (body.endDate !== undefined) {
    const d = new Date(body.endDate);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
    data.endDate = d;
    end = d;
  }
  if (end < start) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  if (body.notes !== undefined) data.notes = body.notes;

  // Over-allocation check (exclude self)
  const existing = await prisma.allocation.findMany({
    where: {
      tenantId: ctx.tenantId,
      employeeId: alloc.employeeId,
      startDate: { lte: end },
      endDate: { gte: start },
      NOT: { id },
    },
    select: { id: true, percentage: true, startDate: true, endDate: true },
  });
  const check = checkOverAllocation(existing, {
    employeeId: alloc.employeeId,
    percentage: pct,
    startDate: start,
    endDate: end,
  });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const updated = await prisma.allocation.update({ where: { id }, data });
  return NextResponse.json({ allocation: updated });
}
