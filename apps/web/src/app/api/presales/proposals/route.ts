import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePresalesAuthz, isResponse, serializeProposal } from "../_lib";
import { PRESALES_STATUSES } from "@/features/presales/lib/presales";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePresalesAuthz(PERMISSIONS.PRESALES_PROPOSAL_READ, { resourceType: "presales_proposal" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const opportunityId = (searchParams.get("opportunityId") ?? "").trim();

  const where: any = { tenantId: ctx.tenantId };
  if (status && (PRESALES_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (opportunityId) where.opportunityId = opportunityId;

  const proposals = await prisma.presalesProposal.findMany({
    where,
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ proposals: proposals.map(serializeProposal) });
}

export async function POST(req: NextRequest) {
  const auth = await requirePresalesAuthz(PERMISSIONS.PRESALES_PROPOSAL_CREATE, { resourceType: "presales_proposal" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const number = typeof body.number === "string" ? body.number.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "USD";
  const marginPct = typeof body.marginPct === "number" ? body.marginPct : 0.2;

  if (!number || !title) {
    return NextResponse.json({ error: "number and title are required" }, { status: 400 });
  }

  const proposal = await prisma.$transaction(async (tx) => {
    const prop = await tx.presalesProposal.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        title,
        opportunityId: typeof body.opportunityId === "string" && body.opportunityId ? body.opportunityId : null,
        status: "draft",
        currency,
        marginPct,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        createdBy: ctx.userId,
      },
      include: { lines: true },
    });

    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "presales_proposal",
        entityId: prop.id,
        toStatus: "draft",
        actorId: ctx.userId,
        reason: "Presales proposal created",
      },
    });

    return prop;
  });

  return NextResponse.json({ proposal: serializeProposal(proposal) }, { status: 201 });
}
