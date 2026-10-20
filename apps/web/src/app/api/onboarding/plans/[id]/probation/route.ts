import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_PROBATION_REVIEW);
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
  const startOn = body.startOn ? new Date(body.startOn) : plan.startedOn ?? new Date();
  const dueOn = body.dueOn ? new Date(body.dueOn) : null;
  if (isNaN(startOn.getTime())) return NextResponse.json({ error: "Invalid startOn" }, { status: 400 });
  if (!dueOn || isNaN(dueOn.getTime())) return NextResponse.json({ error: "dueOn is required" }, { status: 400 });
  if (dueOn.getTime() <= startOn.getTime()) return NextResponse.json({ error: "dueOn must be after startOn" }, { status: 400 });
  for (const key of ["managerEmployeeId", "employeeReviewerId"] as const) {
    if (body[key]) {
      const emp = await prisma.employee.findFirst({ where: { id: body[key], tenantId: ctx.tenantId }, select: { id: true } });
      if (!emp) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    }
  }

  const review = await prisma.probationReview.create({
    data: {
      tenantId: ctx.tenantId,
      planId: plan.id,
      startOn,
      dueOn,
      managerEmployeeId: body.managerEmployeeId ?? null,
      employeeReviewerId: body.employeeReviewerId ?? null,
      status: "pending",
    },
  });
  await prisma.stageHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityType: "probation_review",
      entityId: review.id,
      toStatus: "pending",
      actorId: ctx.userId,
      reason: `Probation review created for plan ${plan.id}`,
    },
  });
  return NextResponse.json({ probation: review }, { status: 201 });
}
