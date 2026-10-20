import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../_lib";
import { deriveCompletionPct, ONBOARDING_PLAN_STATUSES, type OnboardingTaskStatus } from "@/features/onboarding/lib/onboarding";
import { instantiatePlanForOffer } from "@/features/onboarding/lib/onboarding-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_PLAN_READ);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();

  const where: any = { tenantId: ctx.tenantId };
  if (status && (ONBOARDING_PLAN_STATUSES as readonly string[]).includes(status)) where.status = status;

  const plans = await prisma.onboardingPlan.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  const planIds = plans.map((p) => p.id);
  const tasks = await prisma.onboardingTask.findMany({ where: { tenantId: ctx.tenantId, planId: { in: planIds } } });
  const tasksByPlan = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const arr = tasksByPlan.get(t.planId) ?? [];
    arr.push(t);
    tasksByPlan.set(t.planId, arr);
  }
  const candidateIds = [...new Set(plans.map((p) => p.candidateId))];
  const candidates = await prisma.candidate.findMany({ where: { tenantId: ctx.tenantId, id: { in: candidateIds } }, select: { id: true, fullName: true } });
  const nameById = new Map(candidates.map((c) => [c.id, c.fullName]));

  const out = plans.map((p) => {
    const pt = tasksByPlan.get(p.id) ?? [];
    return {
      ...p,
      candidateName: nameById.get(p.candidateId) ?? null,
      completionPct: deriveCompletionPct(pt.map((t) => ({ status: t.status as OnboardingTaskStatus }))),
      blockedCount: pt.filter((t) => t.status === "blocked").length,
    };
  });
  return NextResponse.json({ plans: out });
}

// Create a plan for an accepted offer (idempotent).
export async function POST(req: NextRequest) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_PLAN_CREATE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.offerId || typeof body.offerId !== "string") return NextResponse.json({ error: "Missing offerId" }, { status: 400 });

  const offer = await prisma.offer.findFirst({ where: { id: body.offerId, tenantId: ctx.tenantId } });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (offer.status !== "accepted") return NextResponse.json({ error: "An onboarding plan can only be created from an accepted offer" }, { status: 409 });

  const result = await instantiatePlanForOffer(ctx.tenantId, offer, ctx.userId);
  const plan = await prisma.onboardingPlan.findFirst({ where: { id: result.planId, tenantId: ctx.tenantId } });
  return NextResponse.json({ plan, created: result.created }, { status: result.created ? 201 : 200 });
}
