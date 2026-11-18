import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionPayrollRun } from "@/features/payroll/lib/payroll-engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_RUN_APPROVE, {
    tenantId: ctx.tenantId,
    resourceType: "payroll_run",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const run = await prisma.payrollRun.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!run) {
    return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
  }

  if (run.status !== "calculated") {
    return NextResponse.json(
      { error: `Run must be in 'calculated' status to approve (currently '${run.status}')` },
      { status: 400 }
    );
  }

  // Segregation of Duties (SoD): The approving officer cannot be the same employee who executed the run
  if (run.executedBy === ctx.employeeId) {
    return NextResponse.json(
      {
        error:
          "Segregation of Duties (SoD) violation: The payroll run executor cannot approve their own run. A distinct finance officer must approve.",
      },
      { status: 403 }
    );
  }

  if (!canTransitionPayrollRun(run.status as any, "approved")) {
    return NextResponse.json(
      { error: `Invalid status transition from ${run.status} to approved` },
      { status: 400 }
    );
  }

  const updated = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: "approved",
      approvedBy: ctx.employeeId,
      approvedAt: new Date(),
    },
  });

  return NextResponse.json({
    data: {
      ...updated,
      totalGrossCents: updated.totalGrossCents.toString(),
      totalDeductionsCents: updated.totalDeductionsCents.toString(),
      totalNetCents: updated.totalNetCents.toString(),
    },
  });
}
