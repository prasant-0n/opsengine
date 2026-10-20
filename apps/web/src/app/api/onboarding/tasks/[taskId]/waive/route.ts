import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";
import { recomputePlanStatus } from "@/features/onboarding/lib/onboarding-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_TASK_MANAGE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { taskId } = await params;

  const task = await prisma.onboardingTask.findFirst({ where: { id: taskId, tenantId: ctx.tenantId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.status === "completed" || task.status === "cancelled") return NextResponse.json({ error: "Task is already closed" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "A reason is required to waive a task" }, { status: 400 });
  }

  const updated = await prisma.onboardingTask.update({
    where: { id: task.id },
    data: { status: "waived", blockedReason: body.reason.trim(), completedAt: new Date() },
  });
  await recomputePlanStatus(ctx.tenantId, task.planId);
  return NextResponse.json({ task: updated });
}
