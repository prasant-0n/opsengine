import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOfferAuthz, isResponse, serializeOffer } from "../../_lib";
import { isOfferEditable, isValidAmountCents, isKnownEmploymentType, isKnownWorkMode } from "@/features/recruitment/lib/offers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_READ);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const offer = await prisma.offer.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [candidate, template, plan] = await Promise.all([
    prisma.candidate.findFirst({ where: { tenantId: ctx.tenantId, id: offer.candidateId }, select: { id: true, fullName: true, email: true } }),
    offer.templateId ? prisma.offerTemplate.findFirst({ where: { tenantId: ctx.tenantId, id: offer.templateId } }) : Promise.resolve(null),
    prisma.onboardingPlan.findFirst({ where: { tenantId: ctx.tenantId, offerId: offer.id }, select: { id: true, status: true } }),
  ]);

  return NextResponse.json({ offer: serializeOffer(offer), candidate, template, plan });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_CREATE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const offer = await prisma.offer.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Governed status change: never via PATCH (ADR-0009).
  if ("status" in body) return NextResponse.json({ error: "Status changes are governed actions", code: "GOVERNED_ACTION" }, { status: 400 });

  if (!isOfferEditable(offer)) return NextResponse.json({ error: "Only draft offers can be edited" }, { status: 409 });

  const data: any = {};
  if (body.jobTitle !== undefined) {
    if (typeof body.jobTitle !== "string" || !body.jobTitle.trim()) return NextResponse.json({ error: "Invalid jobTitle" }, { status: 400 });
    data.jobTitle = body.jobTitle.trim();
  }
  if (body.grade !== undefined) data.grade = typeof body.grade === "string" ? body.grade : null;
  if (body.employmentType !== undefined) {
    if (body.employmentType !== null && !isKnownEmploymentType(body.employmentType)) return NextResponse.json({ error: "Invalid employmentType" }, { status: 400 });
    data.employmentType = body.employmentType;
  }
  if (body.workMode !== undefined) {
    if (body.workMode !== null && !isKnownWorkMode(body.workMode)) return NextResponse.json({ error: "Invalid workMode" }, { status: 400 });
    data.workMode = body.workMode;
  }
  if (body.location !== undefined) data.location = typeof body.location === "string" ? body.location : null;
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes : null;
  if (body.baseCompCents !== undefined) {
    if (!isValidAmountCents(body.baseCompCents)) return NextResponse.json({ error: "baseCompCents must be non-negative integer cents" }, { status: 400 });
    data.baseCompCents = BigInt(body.baseCompCents);
  }
  if (body.variableCents !== undefined) {
    if (body.variableCents !== null && !isValidAmountCents(body.variableCents)) return NextResponse.json({ error: "variableCents must be non-negative integer cents" }, { status: 400 });
    data.variableCents = body.variableCents !== null ? BigInt(body.variableCents) : null;
  }
  if (body.startDate !== undefined) {
    const d = body.startDate ? new Date(body.startDate) : null;
    if (d && isNaN(d.getTime())) return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    data.startDate = d;
  }

  const updated = await prisma.offer.update({ where: { id: offer.id }, data });
  return NextResponse.json({ offer: serializeOffer(updated) });
}
