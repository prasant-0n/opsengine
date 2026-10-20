import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePresalesAuthz, isResponse, serializeProposal } from "../../../_lib";
import { deriveProposalTotals } from "@/features/presales/lib/presales";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePresalesAuthz(PERMISSIONS.PRESALES_PROPOSAL_CREATE, { resourceType: "presales_proposal" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const proposal = await prisma.presalesProposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { lines: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "draft") {
    return NextResponse.json({ error: "Proposal is not in draft status", code: "NOT_EDITABLE" }, { status: 409 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle.trim() : "";
  const hours = Number(body.hours) || 0;
  const hourlyRateCents = BigInt(body.hourlyRateCents ?? 0);

  if (!roleTitle || hours < 0 || hourlyRateCents < 0n) {
    return NextResponse.json({ error: "Valid roleTitle, non-negative hours and hourlyRateCents are required" }, { status: 400 });
  }

  const lineTotalCents = BigInt(hours) * hourlyRateCents;

  const updatedProposal = await prisma.$transaction(async (tx) => {
    await tx.presalesEstimateLine.create({
      data: {
        tenantId: ctx.tenantId,
        proposalId: proposal.id,
        roleTitle,
        hours,
        hourlyRateCents,
        totalCents: lineTotalCents,
      },
    });

    const lines = await tx.presalesEstimateLine.findMany({ where: { tenantId: ctx.tenantId, proposalId: proposal.id } });
    const { totalAmountCents } = deriveProposalTotals(lines);

    return tx.presalesProposal.update({
      where: { id: proposal.id },
      data: { totalAmountCents },
      include: { lines: true },
    });
  });

  return NextResponse.json({ proposal: serializeProposal(updatedProposal) }, { status: 201 });
}
