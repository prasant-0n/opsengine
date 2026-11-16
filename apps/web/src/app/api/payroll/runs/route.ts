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

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_RUN_READ, {
    tenantId: ctx.tenantId,
    resourceType: "payroll_run",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const runs = await prisma.payrollRun.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  const serialized = runs.map((r) => ({
    ...r,
    totalGrossCents: r.totalGrossCents.toString(),
    totalDeductionsCents: r.totalDeductionsCents.toString(),
    totalNetCents: r.totalNetCents.toString(),
  }));

  return NextResponse.json({ data: serialized });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_RUN_EXECUTE, {
    tenantId: ctx.tenantId,
    resourceType: "payroll_run",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const year = parseInt(body.year, 10) || new Date().getUTCFullYear();
  const month = parseInt(body.month, 10) || new Date().getUTCMonth() + 1;

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month (must be between 1 and 12)" }, { status: 400 });
  }

  // Check if run already exists for this tenant, year, and month
  const existing = await prisma.payrollRun.findUnique({
    where: {
      tenantId_periodYear_periodMonth: {
        tenantId: ctx.tenantId,
        periodYear: year,
        periodMonth: month,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: `Payroll run already exists for ${year}-${String(month).padStart(2, "0")}` },
      { status: 409 }
    );
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const runNumber = `PR-${year}-${String(month).padStart(2, "0")}`;

  const created = await prisma.payrollRun.create({
    data: {
      tenantId: ctx.tenantId,
      runNumber,
      periodYear: year,
      periodMonth: month,
      periodStart: startDate,
      periodEnd: endDate,
      status: "draft",
      executedBy: ctx.employeeId,
    },
  });

  return NextResponse.json(
    {
      data: {
        ...created,
        totalGrossCents: created.totalGrossCents.toString(),
        totalDeductionsCents: created.totalDeductionsCents.toString(),
        totalNetCents: created.totalNetCents.toString(),
      },
    },
    { status: 201 }
  );
}
