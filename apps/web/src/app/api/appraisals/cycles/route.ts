import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.APPRAISAL_CYCLE_READ, {
    tenantId: ctx.tenantId,
    resourceType: "appraisal_cycle",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cycles = await prisma.appraisalCycle.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: cycles });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.APPRAISAL_CYCLE_MANAGE, {
    tenantId: ctx.tenantId,
    resourceType: "appraisal_cycle",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    name,
    periodYear,
    periodQuarter,
    startDate,
    endDate,
    selfReviewDeadline,
    managerReviewDeadline,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "Cycle name is required" }, { status: 400 });
  }

  const cycle = await prisma.appraisalCycle.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      periodYear: parseInt(periodYear, 10) || new Date().getUTCFullYear(),
      periodQuarter: periodQuarter ? parseInt(periodQuarter, 10) : null,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 86400000),
      selfReviewDeadline: selfReviewDeadline
        ? new Date(selfReviewDeadline)
        : new Date(Date.now() + 14 * 86400000),
      managerReviewDeadline: managerReviewDeadline
        ? new Date(managerReviewDeadline)
        : new Date(Date.now() + 21 * 86400000),
      status: "active",
    },
  });

  return NextResponse.json({ data: cycle }, { status: 201 });
}
