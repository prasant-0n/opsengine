import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePresalesAuthz, isResponse, serializeProposal } from "../../../_lib";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePresalesAuthz(PERMISSIONS.PRESALES_PROPOSAL_APPROVE, { resourceType: "presales_proposal" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const proposal = await prisma.presalesProposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { lines: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status === "approved") {
    return NextResponse.json({ error: "Proposal is already approved" }, { status: 409 });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const prop = await tx.presalesProposal.update({
      where: { id: proposal.id },
      data: {
        status: "approved",
        approvedBy: ctx.userId,
        approvedAt: now,
      },
      include: { lines: true },
    });

    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "presales_proposal",
        entityId: proposal.id,
        fromStatus: proposal.status,
        toStatus: "approved",
        actorId: ctx.userId,
        reason: "Presales proposal approved.",
      },
    });

    return prop;
  });

  return NextResponse.json({ proposal: serializeProposal(updated) });
}
