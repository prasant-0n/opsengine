import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOfferAuthz, isResponse, serializeOffer } from "../../../_lib";

export const dynamic = "force-dynamic";

// Governed action: sending requires the linked approval instance to be approved.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_SEND);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const offer = await prisma.offer.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (offer.status === "sent" || offer.status === "accepted" || offer.status === "declined") {
    return NextResponse.json({ error: "Offer has already been sent" }, { status: 409 });
  }
  if (offer.status === "withdrawn" || offer.status === "expired") {
    return NextResponse.json({ error: "Offer is no longer active" }, { status: 409 });
  }
  if (!offer.approvalInstanceId) {
    return NextResponse.json({ error: "Offer requires approval before it can be sent", code: "NOT_APPROVED" }, { status: 409 });
  }
  const instance = await prisma.approvalInstance.findFirst({ where: { id: offer.approvalInstanceId, tenantId: ctx.tenantId } });
  if (!instance || instance.status !== "approved") {
    return NextResponse.json({ error: "Offer approval is not yet approved", code: "NOT_APPROVED" }, { status: 409 });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.offer.update({ where: { id: offer.id }, data: { status: "sent", sentAt: now } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "offer",
        entityId: offer.id,
        fromStatus: offer.status,
        toStatus: "sent",
        actorId: ctx.userId,
        reason: `Sent offer ${offer.number}`,
      },
    });
    return u;
  });
  return NextResponse.json({ offer: serializeOffer(updated) });
}
