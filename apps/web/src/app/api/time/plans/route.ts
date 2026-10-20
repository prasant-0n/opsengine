import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { deriveDailyReport } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") ?? new Date().toISOString().slice(0, 10)).trim();
  const employeeIdParam = (searchParams.get("employeeId") ?? "").trim();
  const targetEmployeeId = employeeIdParam || ctx.employeeId;
  if (!targetEmployeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });
  const isSelf = targetEmployeeId === ctx.employeeId;

  const perm = isSelf ? PERMISSIONS.TIME_ENTRY_READ_SELF : PERMISSIONS.TIME_DAR_REVIEW;
  const authz = authorize(ctx, perm, { tenantId: ctx.tenantId, resourceType: "daily_plan", owningEmployeeId: targetEmployeeId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plan = await prisma.dailyPlan.findFirst({
    where: { tenantId: ctx.tenantId, employeeId: targetEmployeeId, planDate: new Date(date + "T00:00:00Z") },
  });
  if (!plan) return NextResponse.json({ plan: null, items: [], report: null });

  const items = await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ plan, items, report: deriveDailyReport(items) });
}

export async function POST(req: NextRequest) {
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
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body; default to today
  }
  const date = (body.date ?? new Date().toISOString().slice(0, 10)).trim();

  const planDate = new Date(date + "T00:00:00Z");
  const plan = await prisma.dailyPlan.upsert({
    where: { tenantId_employeeId_planDate: { tenantId: ctx.tenantId, employeeId: ctx.employeeId, planDate } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      employeeId: ctx.employeeId,
      planDate,
      status: "draft",
      notes: body.notes ?? null,
    },
  });
  const items = await prisma.dailyPlanItem.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ plan, items, report: deriveDailyReport(items) }, { status: 201 });
}
