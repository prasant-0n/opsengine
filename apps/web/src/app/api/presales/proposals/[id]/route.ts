import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePresalesAuthz, isResponse, serializeProposal } from "../../_lib";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePresalesAuthz(PERMISSIONS.PRESALES_PROPOSAL_READ, { resourceType: "presales_proposal" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const proposal = await prisma.presalesProposal.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { lines: true },
  });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ proposal: serializeProposal(proposal) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePresalesAuthz(PERMISSIONS.PRESALES_PROPOSAL_CREATE, { resourceType: "presales_proposal" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const proposal = await prisma.presalesProposal.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "draft") {
    return NextResponse.json({ error: "Only draft proposals can be edited", code: "NOT_EDITABLE" }, { status: 409 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if ("status" in body) return NextResponse.json({ error: "Status changes are governed actions", code: "GOVERNED_ACTION" }, { status: 400 });

  const data: any = {};
  if (body.title !== undefined) data.title = typeof body.title === "string" ? body.title.trim() : proposal.title;
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes : null;
  if (body.marginPct !== undefined) data.marginPct = Number(body.marginPct) || proposal.marginPct;

  const updated = await prisma.presalesProposal.update({
    where: { id: proposal.id },
    data,
    include: { lines: true },
  });

  return NextResponse.json({ proposal: serializeProposal(updated) });
}
