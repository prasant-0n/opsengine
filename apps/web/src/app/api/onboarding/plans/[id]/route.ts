import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../_lib";
import { deriveCompletionPct, type OnboardingTaskStatus } from "@/features/onboarding/lib/onboarding";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_PLAN_READ);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const plan = await prisma.onboardingPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [tasks, dependencies, induction, policies, probation, candidate, offer] = await Promise.all([
    prisma.onboardingTask.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id }, orderBy: { createdAt: "asc" } }),
    prisma.onboardingTaskDependency.findMany({ where: { tenantId: ctx.tenantId } }),
    prisma.inductionEvent.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id }, orderBy: { startAt: "asc" } }),
    prisma.policyAcknowledgement.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id }, orderBy: { acknowledgedAt: "desc" } }),
    prisma.probationReview.findMany({ where: { tenantId: ctx.tenantId, planId: plan.id }, orderBy: { createdAt: "desc" } }),
    prisma.candidate.findFirst({ where: { tenantId: ctx.tenantId, id: plan.candidateId }, select: { id: true, fullName: true, email: true } }),
    prisma.offer.findFirst({ where: { tenantId: ctx.tenantId, id: plan.offerId }, select: { id: true, number: true, jobTitle: true } }),
  ]);

  const taskIds = new Set(tasks.map((t) => t.id));
  const planDeps = dependencies.filter((d) => taskIds.has(d.taskId));
  return NextResponse.json({
    plan: {
      ...plan,
      completionPct: deriveCompletionPct(tasks.map((t) => ({ status: t.status as OnboardingTaskStatus }))),
    },
    tasks,
    dependencies: planDeps,
    induction,
    policies,
    probation,
    candidate,
    offer,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_PLAN_UPDATE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const plan = await prisma.onboardingPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Governed status change: never via PATCH (ADR-0009).
  if ("status" in body) return NextResponse.json({ error: "Status changes are governed actions", code: "GOVERNED_ACTION" }, { status: 400 });

  const data: any = {};
  if (body.buddyEmployeeId !== undefined) {
    if (body.buddyEmployeeId) {
      const emp = await prisma.employee.findFirst({ where: { id: body.buddyEmployeeId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!emp) return NextResponse.json({ error: "Invalid buddyEmployeeId" }, { status: 400 });
    }
    data.buddyEmployeeId = body.buddyEmployeeId ?? null;
  }
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes : null;

  const updated = await prisma.onboardingPlan.update({ where: { id: plan.id }, data });
  return NextResponse.json({ plan: updated });
}
