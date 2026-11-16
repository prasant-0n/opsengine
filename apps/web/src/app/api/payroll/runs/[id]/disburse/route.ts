import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  canTransitionPayrollRun,
  generateBankBatchExport,
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

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_RUN_DISBURSE, {
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

  if (run.status !== "approved") {
    return NextResponse.json(
      { error: `Run must be in 'approved' status to disburse (currently '${run.status}')` },
      { status: 400 }
    );
  }

  if (!canTransitionPayrollRun(run.status as any, "disbursed")) {
    return NextResponse.json(
      { error: `Invalid status transition from ${run.status} to disbursed` },
      { status: 400 }
    );
  }

  // Fetch payslips with employee details and bank accounts
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: run.id, tenantId: ctx.tenantId },
  });

  const empIds = payslips.map((p) => p.employeeId);
  const [employees, structures] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: empIds }, tenantId: ctx.tenantId },
      select: { id: true, displayName: true, workEmail: true },
    }),
    prisma.salaryStructure.findMany({
      where: { employeeId: { in: empIds }, tenantId: ctx.tenantId, status: "active" },
    }),
  ]);

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const structMap = new Map(structures.map((s) => [s.employeeId, s]));

  const records = payslips.map((p) => {
    const emp = empMap.get(p.employeeId);
    const struct = structMap.get(p.employeeId);
    return {
      payslipNumber: p.payslipNumber,
      employeeName: emp?.displayName || "Employee",
      employeeEmail: emp?.workEmail || "",
      bankAccountNumber: struct?.bankAccountNumber || "ACCT-DIRECT-DEP",
      bankRoutingCode: struct?.bankRoutingCode || "021000021",
      netPayCents: p.netPayCents,
      currency: p.currency,
    };
  });

  const bankBatchContent = generateBankBatchExport({
    runNumber: run.runNumber,
    periodYear: run.periodYear,
    periodMonth: run.periodMonth,
    records,
  });

  const now = new Date();
  const batchRef = `BATCH-${run.runNumber}-${now.getTime()}`;

  // Update payslips to published & paid with payment reference
  for (let i = 0; i < payslips.length; i++) {
    const p = payslips[i];
    await prisma.payslip.update({
      where: { id: p.id },
      data: {
        status: "published",
        paidAt: now,
        paymentReference: `ACH-${run.runNumber}-${String(i + 1).padStart(4, "0")}`,
      },
    });
  }

  // Finalize payroll run to disbursed
  const updatedRun = await prisma.payrollRun.update({
    where: { id: run.id },
    data: {
      status: "disbursed",
      disbursedAt: now,
      batchExportRef: batchRef,
    },
  });

  return NextResponse.json({
    data: {
      ...updatedRun,
      totalGrossCents: updatedRun.totalGrossCents.toString(),
      totalDeductionsCents: updatedRun.totalDeductionsCents.toString(),
      totalNetCents: updatedRun.totalNetCents.toString(),
      bankBatchContent,
    },
  });
}
