import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isValidItemStatus, isValidMinutes, deriveDailyReport } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const { id, iid } = await params;
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
  if (plan.status !== "draft") return NextResponse.json({ error: `Plan is ${plan.status}; cannot edit items` }, { status: 409 });

  const item = await prisma.dailyPlanItem.findFirst({ where: { id: iid, planId: id, tenantId: ctx.tenantId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.plannedOutcome !== undefined) data.plannedOutcome = body.plannedOutcome;
  if (body.estimatedMinutes !== undefined) {
    const est = typeof body.estimatedMinutes === "string" ? parseInt(body.estimatedMinutes, 10) : body.estimatedMinutes;
    if (!isValidMinutes(est)) return NextResponse.json({ error: "estimatedMinutes must be integer 1–1440" }, { status: 400 });
    data.estimatedMinutes = est;
  }
  if (body.actualMinutes !== undefined) {
    if (body.actualMinutes === null || body.actualMinutes === "") data.actualMinutes = null;
    else {
      const a = typeof body.actualMinutes === "string" ? parseInt(body.actualMinutes, 10) : body.actualMinutes;
      if (!Number.isInteger(a) || a < 0 || a > 1440) return NextResponse.json({ error: "actualMinutes must be integer 0–1440" }, { status: 400 });
      data.actualMinutes = a;
    }
  }
  if (body.status !== undefined) {
    if (!isValidItemStatus(body.status)) return NextResponse.json({ error: "Invalid item status" }, { status: 400 });
    data.status = body.status;
  }
  if (body.outcome !== undefined) data.outcome = body.outcome;
  if (body.blocker !== undefined) data.blocker = body.blocker;
  if (body.evidence !== undefined) data.evidence = body.evidence;
  if (body.projectId !== undefined) {
    if (body.projectId) {
      const ok = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }
    data.projectId = body.projectId ?? null;
  }
  if (body.ticketId !== undefined) {
    if (body.ticketId) {
      const ok = await prisma.ticket.findFirst({ where: { id: body.ticketId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Invalid ticketId" }, { status: 400 });
    }
    data.ticketId = body.ticketId ?? null;
  }

  const updated = await prisma.dailyPlanItem.update({ where: { id: iid }, data });
  const items = await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ item: updated, items, report: deriveDailyReport(items) });
}
