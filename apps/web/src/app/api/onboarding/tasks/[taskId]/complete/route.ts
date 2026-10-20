import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";
import { dependencyBlocked, type OnboardingTaskStatus } from "@/features/onboarding/lib/onboarding";
import { recomputePlanStatus } from "@/features/onboarding/lib/onboarding-service";

export const dynamic = "force-dynamic";

async function loadTask(tenantId: string, taskId: string) {
  return prisma.onboardingTask.findFirst({ where: { id: taskId, tenantId } });
}

async function dependencyGate(tenantId: string, planId: string, taskId: string): Promise<boolean> {
  const [deps, planTasks] = await Promise.all([
    prisma.onboardingTaskDependency.findMany({ where: { tenantId, taskId } }),
    prisma.onboardingTask.findMany({ where: { tenantId, planId }, select: { id: true, status: true } }),
  ]);
  const statusById = new Map(planTasks.map((t) => [t.id, t.status as OnboardingTaskStatus]));
  return dependencyBlocked(taskId, deps.map((d) => ({ taskId: d.taskId, dependsOnTaskId: d.dependsOnTaskId })), statusById);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_TASK_MANAGE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { taskId } = await params;

  const task = await loadTask(ctx.tenantId, taskId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.status === "completed" || task.status === "cancelled") return NextResponse.json({ error: "Task is already closed" }, { status: 409 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (await dependencyGate(ctx.tenantId, task.planId, task.id)) {
    return NextResponse.json({ error: "A prerequisite task is not complete", code: "DEPENDENCY_INCOMPLETE" }, { status: 409 });
  }

  const updated = await prisma.onboardingTask.update({
    where: { id: task.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      evidenceRef: typeof body.evidenceRef === "string" ? body.evidenceRef : task.evidenceRef,
    },
  });
  await recomputePlanStatus(ctx.tenantId, task.planId);
  return NextResponse.json({ task: updated });
}
