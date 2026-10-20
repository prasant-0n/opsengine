import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { deriveDailyReport } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_DAR_SUBMIT, {
    tenantId: ctx.tenantId,
    resourceType: "daily_plan",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plan = await prisma.dailyPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.employeeId !== ctx.employeeId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (plan.status !== "draft") return NextResponse.json({ error: `Cannot submit from status '${plan.status}'` }, { status: 409 });

  const items = await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: id } });
  if (items.length === 0) return NextResponse.json({ error: "Cannot submit an empty plan" }, { status: 400 });

  const report = deriveDailyReport(items);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.dailyPlan.update({ where: { id }, data: { status: "submitted" } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "daily_plan",
        entityId: id,
        fromStatus: "draft",
        toStatus: "submitted",
        actorId: ctx.userId,
        reason: "plan submitted",
      },
    });
    // Immutable report snapshot (append-only version)
    const last = await tx.dailyReportVersion.findFirst({
      where: { tenantId: ctx.tenantId, employeeId: plan.employeeId, reportDate: plan.planDate },
      orderBy: { version: "desc" },
    });
    await tx.dailyReportVersion.create({
      data: {
        tenantId: ctx.tenantId,
        employeeId: plan.employeeId,
        reportDate: plan.planDate,
        version: (last?.version ?? 0) + 1,
        payload: { report, itemCount: items.length } as any,
        note: "submitted",
        createdBy: ctx.userId,
      },
    });
    return u;
  });
  return NextResponse.json({ plan: updated, report });
}
