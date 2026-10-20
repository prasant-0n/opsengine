import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canEditPlanItems, deriveDailyReport } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_DAR_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "daily_plan",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = await prisma.dailyPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.employeeId !== ctx.employeeId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Submitted/reviewed plans are immutable except status via governed endpoints.
  if (body.status !== undefined) {
    return NextResponse.json(
      { error: "Governed transition requires dedicated POST endpoint", code: "GOVERNED_ACTION" },
      { status: 400 }
    );
  }
  if (!canEditPlanItems(plan.status)) {
    return NextResponse.json({ error: `Plan is ${plan.status}; content is immutable` }, { status: 409 });
  }

  const data: any = {};
  if (body.notes !== undefined) data.notes = body.notes;

  const updated = await prisma.dailyPlan.update({ where: { id }, data });
  const items = await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ plan: updated, items, report: deriveDailyReport(items) });
}
