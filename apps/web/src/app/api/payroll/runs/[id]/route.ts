import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

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

  const authz = authorize(ctx, PERMISSIONS.PAYROLL_RUN_READ, {
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

  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: run.id, tenantId: ctx.tenantId },
    orderBy: { payslipNumber: "asc" },
  });

  const empIds = payslips.map((p) => p.employeeId);
  const employees = await prisma.employee.findMany({
    where: { id: { in: empIds }, tenantId: ctx.tenantId },
    select: { id: true, displayName: true, workEmail: true, department: true },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const serializedPayslips = payslips.map((p) => ({
    ...p,
    basicCents: p.basicCents.toString(),
    hraCents: p.hraCents.toString(),
    allowancesCents: p.allowancesCents.toString(),
    grossPayCents: p.grossPayCents.toString(),
    pfEmployeeCents: p.pfEmployeeCents.toString(),
    pfEmployerCents: p.pfEmployerCents.toString(),
    taxTdsCents: p.taxTdsCents.toString(),
    lopDeductionCents: p.lopDeductionCents.toString(),
    totalDeductionsCents: p.totalDeductionsCents.toString(),
    netPayCents: p.netPayCents.toString(),
    employee: empMap.get(p.employeeId) ?? null,
  }));

  return NextResponse.json({
    data: {
      ...run,
      totalGrossCents: run.totalGrossCents.toString(),
      totalDeductionsCents: run.totalDeductionsCents.toString(),
      totalNetCents: run.totalNetCents.toString(),
      payslips: serializedPayslips,
    },
  });
}
