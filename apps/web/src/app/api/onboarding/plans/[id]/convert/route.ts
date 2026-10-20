import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";
import { canConvert, type OnboardingPlanStatus } from "@/features/onboarding/lib/onboarding";

export const dynamic = "force-dynamic";

// Governed, idempotent candidate→employee conversion (Module 4 boundary).
// Creates the Employee once (dedupe tenant+email); repeated calls return the same employee.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_CONVERT_EMPLOYEE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const plan = await prisma.onboardingPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotency: if already converted, return the linked employee.
  if (plan.createdEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: plan.createdEmployeeId, tenantId: ctx.tenantId } });
    return NextResponse.json({ employee: emp, created: false });
  }

  const confirmation = await prisma.probationReview.findFirst({
    where: { tenantId: ctx.tenantId, planId: plan.id, recommendation: "confirm", status: "completed" },
    select: { id: true },
  });
  if (!canConvert({ planStatus: plan.status as OnboardingPlanStatus, hasConfirmation: !!confirmation })) {
    return NextResponse.json({ error: "Probation must be confirmed (or the plan completed) before conversion", code: "NOT_CONFIRMED" }, { status: 409 });
  }

  const [candidate, offer] = await Promise.all([
    prisma.candidate.findFirst({ where: { tenantId: ctx.tenantId, id: plan.candidateId } }),
    prisma.offer.findFirst({ where: { tenantId: ctx.tenantId, id: plan.offerId } }),
  ]);
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const employee = await prisma.$transaction(async (tx) => {
    // De-duplicate identity: reuse an existing employee for the same tenant + work email.
    const email = candidate.email || null;
    let emp = email ? await tx.employee.findFirst({ where: { tenantId: ctx.tenantId, workEmail: email } }) : null;
    if (!emp) {
      emp = await tx.employee.create({
        data: {
          tenantId: ctx.tenantId,
          displayName: candidate.fullName,
          workEmail: email,
          jobTitle: offer?.jobTitle ?? null,
          employmentType: offer?.employmentType ?? plan.employmentType ?? null,
          location: offer?.location ?? plan.location ?? null,
          startDate: offer?.startDate ?? plan.startedOn ?? null,
          employmentStatus: "active",
        },
      });
    }
    await tx.onboardingPlan.update({ where: { id: plan.id }, data: { createdEmployeeId: emp.id } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "onboarding_plan",
        entityId: plan.id,
        fromStatus: plan.status,
        toStatus: plan.status,
        actorId: ctx.userId,
        reason: `Converted candidate to employee ${emp.id}`,
      },
    });
    return emp;
  });

  return NextResponse.json({ employee, created: true }, { status: 201 });
}
