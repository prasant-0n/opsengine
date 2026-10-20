import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOfferAuthz, isResponse, serializeOffer } from "../../../_lib";
import { isKnownOfferResponseAction } from "@/features/recruitment/lib/offers";
import { instantiatePlanForOffer } from "@/features/onboarding/lib/onboarding-service";

export const dynamic = "force-dynamic";

// Record the candidate's response to a sent offer. Accept → instantiate an onboarding plan
// (idempotent) → preboarding.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_DECIDE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const offer = await prisma.offer.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (offer.status !== "sent") return NextResponse.json({ error: "Only a sent offer can receive a response" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isKnownOfferResponseAction(body.action)) return NextResponse.json({ error: "action must be accept, decline or withdraw" }, { status: 400 });
  if (body.action === "decline" && (!body.reason || typeof body.reason !== "string" || !body.reason.trim())) {
    return NextResponse.json({ error: "A reason is required to decline an offer" }, { status: 400 });
  }

  const now = new Date();
  const newStatus = body.action === "accept" ? "accepted" : body.action === "decline" ? "declined" : "withdrawn";

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: newStatus,
        respondedAt: now,
        declineReason: body.action === "decline" ? body.reason.trim() : offer.declineReason,
      },
    });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "offer",
        entityId: offer.id,
        fromStatus: "sent",
        toStatus: newStatus,
        actorId: ctx.userId,
        reason: body.action === "decline" ? body.reason.trim() : `Candidate ${body.action}ed offer ${offer.number}`,
      },
    });
    return u;
  });

  let plan: { planId: string; created: boolean } | null = null;
  if (body.action === "accept") {
    plan = await instantiatePlanForOffer(ctx.tenantId, offer, ctx.userId);
    // Reflect acceptance on the candidate record (terminal hiring stage).
    await prisma.candidate.update({ where: { id: offer.candidateId }, data: { status: "accepted" } });
  }

  return NextResponse.json({ offer: serializeOffer(updated), plan });
}
