import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { deriveDailyReport } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

// Reviewer must be in the reporting tree above the plan owner.
async function isReviewerOf(tenantId: string, reviewerEmployeeId: string, ownerEmployeeId: string): Promise<boolean> {
  if (reviewerEmployeeId === ownerEmployeeId) return false;
  // Walk up the reporting line (bounded) from the owner.
  let current: string | null = ownerEmployeeId;
  for (let i = 0; i < 10 && current; i++) {
    const edge: { managerEmployeeId: string } | null = await prisma.reportingRelationship.findFirst({
      where: {
        tenantId,
        reportEmployeeId: current,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      },
      select: { managerEmployeeId: true },
    });
    if (!edge) break;
    if (edge.managerEmployeeId === reviewerEmployeeId) return true;
    current = edge.managerEmployeeId;
  }
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const plan = await prisma.dailyPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.status !== "submitted") return NextResponse.json({ error: `Cannot review from status '${plan.status}'` }, { status: 409 });

  const authz = authorize(ctx, PERMISSIONS.TIME_DAR_REVIEW, {
    tenantId: ctx.tenantId,
    resourceType: "daily_plan",
    id: plan.id,
    owningEmployeeId: plan.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reviewerOk =
    ctx.employeeId !== null && (await isReviewerOf(ctx.tenantId, ctx.employeeId, plan.employeeId));
  if (!reviewerOk) return NextResponse.json({ error: "Not in reporting line of plan owner" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // note optional
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.dailyPlan.update({ where: { id }, data: { status: "reviewed" } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "daily_plan",
        entityId: id,
        fromStatus: "submitted",
        toStatus: "reviewed",
        actorId: ctx.userId,
        reason: body.note ?? "plan reviewed",
      },
    });
    return u;
  });
  const items = await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: id } });
  return NextResponse.json({ plan: updated, report: deriveDailyReport(items) });
}
