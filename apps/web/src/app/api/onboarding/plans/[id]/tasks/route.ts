import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";
import { isKnownTaskCategory, wouldCreateCycle } from "@/features/onboarding/lib/onboarding";
import { recomputePlanStatus } from "@/features/onboarding/lib/onboarding-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_TASK_MANAGE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const plan = await prisma.onboardingPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.status === "cancelled") return NextResponse.json({ error: "Plan is cancelled" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (body.category !== undefined && !isKnownTaskCategory(body.category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (body.ownerEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: body.ownerEmployeeId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!emp) return NextResponse.json({ error: "Invalid ownerEmployeeId" }, { status: 400 });
  }
  let dueOn: Date | null = null;
  if (body.dueOn) {
    dueOn = new Date(body.dueOn);
    if (isNaN(dueOn.getTime())) return NextResponse.json({ error: "Invalid dueOn" }, { status: 400 });
  }

  const dependsOnTaskIds: string[] = Array.isArray(body.dependsOnTaskIds) ? body.dependsOnTaskIds.filter((x: unknown) => typeof x === "string") : [];
  if (dependsOnTaskIds.length) {
    const found = await prisma.onboardingTask.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id, id: { in: dependsOnTaskIds } }, select: { id: true } });
    if (found.length !== dependsOnTaskIds.length) return NextResponse.json({ error: "Invalid dependsOnTaskIds" }, { status: 400 });
  }

  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.onboardingTask.create({
      data: {
        tenantId: ctx.tenantId,
        planId: plan.id,
        title: body.title.trim(),
        category: body.category ?? "hr",
        ownerEmployeeId: body.ownerEmployeeId ?? null,
        ownerRole: typeof body.ownerRole === "string" ? body.ownerRole : null,
        dueOn,
        status: "pending",
        createdBy: ctx.userId,
      },
    });
    for (const dep of dependsOnTaskIds) {
      await tx.onboardingTaskDependency.create({ data: { tenantId: ctx.tenantId, taskId: t.id, dependsOnTaskId: dep } });
    }
    return t;
  });

  await recomputePlanStatus(ctx.tenantId, plan.id);
  return NextResponse.json({ task }, { status: 201 });
}
