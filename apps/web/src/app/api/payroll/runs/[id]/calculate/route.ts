import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  calculatePayslipAmounts,
  generatePayslipChecksum,
} from "@/features/payroll/lib/payroll-engine";

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

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_RUN_EXECUTE, {
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

  if (run.status !== "draft" && run.status !== "calculated") {
    return NextResponse.json(
      { error: `Cannot recalculate run in '${run.status}' status` },
      { status: 400 }
    );
  }

  // Fetch all active salary structures in the tenant
  const structures = await prisma.salaryStructure.findMany({
    where: { tenantId: ctx.tenantId, status: "active" },
  });

  if (!structures.length) {
    return NextResponse.json(
      { error: "No active employee salary structures configured in this tenant" },
      { status: 400 }
    );
  }

  // Days in this month
  const workingDays = new Date(run.periodYear, run.periodMonth, 0).getDate();

  let totalGross = 0n;
  let totalDeductions = 0n;
  let totalNet = 0n;
  let count = 0;

  for (const struct of structures) {
    count++;
    const payslipNumber = `PAY-${run.periodYear}${String(run.periodMonth).padStart(2, "0")}-${String(count).padStart(4, "0")}`;

    // Calculate unpaid leave days for this employee in this payroll period
    const unpaidLeaves = await prisma.leaveRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        employeeId: struct.employeeId,
        status: "approved",
        startDate: { lte: run.periodEnd },
        endDate: { gte: run.periodStart },
      },
    });

    // Sum days where leave type is unpaid
    let unpaidDays = 0;
    for (const l of unpaidLeaves) {
      // Check leave type isPaid
      const lt = await prisma.leaveType.findFirst({
        where: { id: l.leaveTypeId, tenantId: ctx.tenantId },
      });
      if (lt && (!lt.isPaid || lt.code.toUpperCase() === "UNPAID")) {
        unpaidDays += l.daysCount;
      }
    }

    const workedDays = Math.max(0, workingDays - unpaidDays);

    const calc = calculatePayslipAmounts({
      salary: {
        basicCents: struct.basicCents,
        hraCents: struct.hraCents,
        allowanceCents: struct.allowanceCents,
        pfEmployeeCents: struct.pfEmployeeCents,
        pfEmployerCents: struct.pfEmployerCents,
        taxTdsCents: struct.taxTdsCents,
      },
      workingDays,
      workedDays,
      unpaidLeaveDays: unpaidDays,
    });

    totalGross += calc.grossPayCents;
    totalDeductions += calc.totalDeductionsCents;
    totalNet += calc.netPayCents;

    const checksum = generatePayslipChecksum({
      tenantId: ctx.tenantId,
      payrollRunId: run.id,
      employeeId: struct.employeeId,
      payslipNumber,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      grossPayCents: calc.grossPayCents,
      totalDeductionsCents: calc.totalDeductionsCents,
      netPayCents: calc.netPayCents,
    });

    await prisma.payslip.upsert({
      where: {
        tenantId_payrollRunId_employeeId: {
          tenantId: ctx.tenantId,
          payrollRunId: run.id,
          employeeId: struct.employeeId,
        },
      },
      update: {
        payslipNumber,
        workingDays,
        workedDays,
        unpaidLeaveDays: unpaidDays,
        basicCents: struct.basicCents,
        hraCents: struct.hraCents,
        allowancesCents: struct.allowanceCents,
        grossPayCents: calc.grossPayCents,
        pfEmployeeCents: calc.pfEmployeeCents,
        pfEmployerCents: calc.pfEmployerCents,
        taxTdsCents: calc.taxTdsCents,
        lopDeductionCents: calc.lopDeductionCents,
        totalDeductionsCents: calc.totalDeductionsCents,
        netPayCents: calc.netPayCents,
        checksumSha256: checksum,
        status: "generated",
      },
      create: {
        tenantId: ctx.tenantId,
        payrollRunId: run.id,
        employeeId: struct.employeeId,
        payslipNumber,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        workingDays,
        workedDays,
        unpaidLeaveDays: unpaidDays,
        basicCents: struct.basicCents,
        hraCents: struct.hraCents,
        allowancesCents: struct.allowanceCents,
        grossPayCents: calc.grossPayCents,
        pfEmployeeCents: calc.pfEmployeeCents,
        pfEmployerCents: calc.pfEmployerCents,
        taxTdsCents: calc.taxTdsCents,
        lopDeductionCents: calc.lopDeductionCents,
        totalDeductionsCents: calc.totalDeductionsCents,
        netPayCents: calc.netPayCents,
        checksumSha256: checksum,
        status: "generated",
      },
    });
  }

  const updatedRun = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: "calculated",
      totalGrossCents: totalGross,
      totalDeductionsCents: totalDeductions,
      totalNetCents: totalNet,
      totalEmployees: count,
    },
  });

  return NextResponse.json({
    data: {
      ...updatedRun,
      totalGrossCents: updatedRun.totalGrossCents.toString(),
      totalDeductionsCents: updatedRun.totalDeductionsCents.toString(),
      totalNetCents: updatedRun.totalNetCents.toString(),
    },
  });
}
