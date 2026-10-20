import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";
import { isKnownProbationRecommendation } from "@/features/onboarding/lib/onboarding";

export const dynamic = "force-dynamic";

// Governed probation decision: confirm | extend | terminate. Audited (stage_history).
export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_PROBATION_DECIDE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { reviewId } = await params;

  const review = await prisma.probationReview.findFirst({ where: { id: reviewId, tenantId: ctx.tenantId } });
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (review.status === "completed") return NextResponse.json({ error: "Review is already completed" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isKnownProbationRecommendation(body.recommendation)) {
    return NextResponse.json({ error: "recommendation must be confirm, extend or terminate" }, { status: 400 });
  }
  if (body.recommendation === "extend" && !body.newEndOn) {
    return NextResponse.json({ error: "newEndOn is required to extend probation" }, { status: 400 });
  }
  let newEndOn: Date | null = null;
  if (body.recommendation === "extend") {
    newEndOn = new Date(body.newEndOn);
    if (isNaN(newEndOn.getTime())) return NextResponse.json({ error: "Invalid newEndOn" }, { status: 400 });
    if (newEndOn.getTime() <= review.dueOn.getTime()) return NextResponse.json({ error: "newEndOn must be after the current due date" }, { status: 400 });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.probationReview.update({
      where: { id: review.id },
      data: {
        status: "completed",
        recommendation: body.recommendation,
        outcome: body.recommendation,
        managerFeedback: typeof body.managerFeedback === "string" ? body.managerFeedback : review.managerFeedback,
        employeeFeedback: typeof body.employeeFeedback === "string" ? body.employeeFeedback : review.employeeFeedback,
        decidedBy: ctx.userId,
        decidedAt: now,
        newEndOn,
        endOn: body.recommendation === "confirm" ? review.dueOn : body.recommendation === "extend" ? newEndOn : review.endOn,
      },
    });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "probation_review",
        entityId: review.id,
        fromStatus: review.status,
        toStatus: "completed",
        actorId: ctx.userId,
        reason: `Probation decision: ${body.recommendation}`,
      },
    });
    return u;
  });

  return NextResponse.json({ probation: updated });
}
