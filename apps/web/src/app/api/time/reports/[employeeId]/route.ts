import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { deriveDailyReport } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

// Derived daily report (planned vs actual) for an employee on a date.
// Self → TIME_ENTRY_READ_SELF; other → TIME_DAR_REVIEW.
export async function GET(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId: ctx.tenantId }, select: { id: true, displayName: true } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSelf = employeeId === ctx.employeeId;
  const perm = isSelf ? PERMISSIONS.TIME_ENTRY_READ_SELF : PERMISSIONS.TIME_DAR_REVIEW;
  const authz = authorize(ctx, perm, { tenantId: ctx.tenantId, resourceType: "daily_report", owningEmployeeId: employeeId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") ?? new Date().toISOString().slice(0, 10)).trim();
  const reportDate = new Date(date + "T00:00:00Z");

  const plan = await prisma.dailyPlan.findFirst({ where: { tenantId: ctx.tenantId, employeeId, planDate: reportDate } });
  const items = plan
    ? await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id }, orderBy: { createdAt: "asc" } })
    : [];
  const report = deriveDailyReport(items);

  const entryTotals = await prisma.timeEntry.aggregate({
    where: { tenantId: ctx.tenantId, employeeId, entryDate: reportDate },
    _sum: { minutes: true },
  });
  const billable = await prisma.timeEntry.aggregate({
    where: { tenantId: ctx.tenantId, employeeId, entryDate: reportDate, billable: true },
    _sum: { minutes: true },
  });

  return NextResponse.json({
    employee: { id: employee.id, displayName: employee.displayName },
    date,
    planStatus: plan?.status ?? null,
    items,
    report,
    recordedMinutes: entryTotals._sum.minutes ?? 0,
    billableMinutes: billable._sum.minutes ?? 0,
  });
}
