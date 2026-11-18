import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { verifyPayslipIntegrity } from "@/features/payroll/lib/payroll-engine";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const { id } = await params;

  const payslip = await prisma.payslip.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!payslip) {
    return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  }

  const canReadAll = authorize(ctx, PERMISSIONS.PAYSLIP_READ_ALL, {
    tenantId: ctx.tenantId,
    resourceType: "payslip",
  }).allowed;

  const isOwner = payslip.employeeId === ctx.employeeId;

  if (!canReadAll && !isOwner) {
    return NextResponse.json({ error: "Forbidden: Cannot access another employee's payslip" }, { status: 403 });
  }

  // Regular employee cannot view draft unapproved payslips
  if (!canReadAll && payslip.status === "draft") {
    return NextResponse.json({ error: "Payslip is not yet published" }, { status: 403 });
  }

  const [employee, run] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: payslip.employeeId, tenantId: ctx.tenantId },
      select: { id: true, displayName: true, workEmail: true, department: true },
    }),
    prisma.payrollRun.findFirst({
      where: { id: payslip.payrollRunId, tenantId: ctx.tenantId },
      select: { id: true, runNumber: true, status: true, periodStart: true, periodEnd: true },
    }),
  ]);

  // Cryptographic tamper-evidence verification
  const isIntegrityVerified = verifyPayslipIntegrity(payslip.checksumSha256, {
    tenantId: payslip.tenantId,
    payrollRunId: payslip.payrollRunId,
    employeeId: payslip.employeeId,
    payslipNumber: payslip.payslipNumber,
    periodYear: payslip.periodYear,
    periodMonth: payslip.periodMonth,
    grossPayCents: payslip.grossPayCents,
    totalDeductionsCents: payslip.totalDeductionsCents,
    netPayCents: payslip.netPayCents,
  });

  return NextResponse.json({
    data: {
      ...payslip,
      basicCents: payslip.basicCents.toString(),
      hraCents: payslip.hraCents.toString(),
      allowancesCents: payslip.allowancesCents.toString(),
      grossPayCents: payslip.grossPayCents.toString(),
      pfEmployeeCents: payslip.pfEmployeeCents.toString(),
      pfEmployerCents: payslip.pfEmployerCents.toString(),
      taxTdsCents: payslip.taxTdsCents.toString(),
      lopDeductionCents: payslip.lopDeductionCents.toString(),
      totalDeductionsCents: payslip.totalDeductionsCents.toString(),
      netPayCents: payslip.netPayCents.toString(),
      employee,
      payrollRun: run,
      isIntegrityVerified,
    },
  });
}
