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

  // Authorize permissions unconditionally
  const canReadAll = authorize(ctx, PERMISSIONS.PAYSLIP_READ_ALL, {
    tenantId: ctx.tenantId,
    resourceType: "payslip",
  }).allowed;

  const canReadSelf = authorize(ctx, PERMISSIONS.PAYSLIP_READ_SELF, {
    tenantId: ctx.tenantId,
    resourceType: "payslip",
    owningEmployeeId: ctx.employeeId,
  }).allowed;

  if (!canReadAll && !canReadSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const empIdParam = searchParams.get("employeeId");

  const whereCondition: any = { tenantId: ctx.tenantId };

  if (yearParam) whereCondition.periodYear = parseInt(yearParam, 10);
  if (monthParam) whereCondition.periodMonth = parseInt(monthParam, 10);

  if (canReadAll) {
    if (empIdParam) whereCondition.employeeId = empIdParam;
  } else {
    // Regular employee: strictly restricted to their own published/paid payslips
    whereCondition.employeeId = ctx.employeeId;
    whereCondition.status = { in: ["published", "paid"] };
  }

  const payslips = await prisma.payslip.findMany({
    where: whereCondition,
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  const empIds = Array.from(new Set(payslips.map((p) => p.employeeId)));
  const employees = await prisma.employee.findMany({
    where: { id: { in: empIds }, tenantId: ctx.tenantId },
    select: { id: true, displayName: true, workEmail: true, department: true },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const serialized = payslips.map((p) => ({
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

  return NextResponse.json({ data: serialized });
}
