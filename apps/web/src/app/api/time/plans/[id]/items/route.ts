import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isValidMinutes, isValidItemPriority, deriveDailyReport } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (plan.status !== "draft") return NextResponse.json({ error: `Plan is ${plan.status}; cannot add items` }, { status: 409 });

  if (!body.title || typeof body.title !== "string") return NextResponse.json({ error: "Missing title" }, { status: 400 });
  const est = typeof body.estimatedMinutes === "string" ? parseInt(body.estimatedMinutes, 10) : body.estimatedMinutes;
  if (!isValidMinutes(est)) return NextResponse.json({ error: "estimatedMinutes must be integer 1–1440" }, { status: 400 });
  const priority = body.priority ?? "medium";
  if (!isValidItemPriority(priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });

  if (body.projectId) {
    const ok = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ok) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }
  if (body.ticketId) {
    const ok = await prisma.ticket.findFirst({ where: { id: body.ticketId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ok) return NextResponse.json({ error: "Invalid ticketId" }, { status: 400 });
  }

  const item = await prisma.dailyPlanItem.create({
    data: {
      tenantId: ctx.tenantId,
      planId: id,
      title: body.title,
      projectId: body.projectId ?? null,
      ticketId: body.ticketId ?? null,
      plannedOutcome: body.plannedOutcome ?? null,
      estimatedMinutes: est,
      priority,
      status: "planned",
    },
  });
  const items = await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ item, items, report: deriveDailyReport(items) }, { status: 201 });
}
