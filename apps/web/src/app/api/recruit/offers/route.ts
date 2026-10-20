import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOfferAuthz, isResponse, serializeOffer } from "../_lib";
import { OFFER_STATUSES, isValidAmountCents, isKnownEmploymentType, isKnownWorkMode, offerNumber } from "@/features/recruitment/lib/offers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_READ);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();

  const where: any = { tenantId: ctx.tenantId };
  if (status && (OFFER_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (q) where.number = { contains: q, mode: "insensitive" };

  const rows = await prisma.offer.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  const candidateIds = [...new Set(rows.map((r) => r.candidateId))];
  const candidates = await prisma.candidate.findMany({
    where: { tenantId: ctx.tenantId, id: { in: candidateIds } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(candidates.map((c) => [c.id, c.fullName]));
  const offers = rows.map((r) => ({ ...serializeOffer(r), candidateName: nameById.get(r.candidateId) ?? null }));
  return NextResponse.json({ offers });
}

export async function POST(req: NextRequest) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_CREATE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.candidateId || typeof body.candidateId !== "string") return NextResponse.json({ error: "Missing candidateId" }, { status: 400 });
  const candidate = await prisma.candidate.findFirst({ where: { id: body.candidateId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!candidate) return NextResponse.json({ error: "Invalid candidateId" }, { status: 400 });

  if (body.requisitionId) {
    const req_ = await prisma.requisition.findFirst({ where: { id: body.requisitionId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!req_) return NextResponse.json({ error: "Invalid requisitionId" }, { status: 400 });
  }
  let templateId: string | null = null;
  if (body.templateId) {
    const tpl = await prisma.offerTemplate.findFirst({ where: { id: body.templateId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!tpl) return NextResponse.json({ error: "Invalid templateId" }, { status: 400 });
    templateId = tpl.id;
  }

  if (!body.jobTitle || typeof body.jobTitle !== "string" || !body.jobTitle.trim()) {
    return NextResponse.json({ error: "jobTitle is required" }, { status: 400 });
  }
  if (!isValidAmountCents(body.baseCompCents)) {
    return NextResponse.json({ error: "baseCompCents must be non-negative integer cents" }, { status: 400 });
  }
  if (body.variableCents !== undefined && body.variableCents !== null && !isValidAmountCents(body.variableCents)) {
    return NextResponse.json({ error: "variableCents must be non-negative integer cents" }, { status: 400 });
  }
  if (body.employmentType !== undefined && body.employmentType !== null && !isKnownEmploymentType(body.employmentType)) {
    return NextResponse.json({ error: "Invalid employmentType" }, { status: 400 });
  }
  if (body.workMode !== undefined && body.workMode !== null && !isKnownWorkMode(body.workMode)) {
    return NextResponse.json({ error: "Invalid workMode" }, { status: 400 });
  }

  const currency = typeof body.currency === "string" && body.currency.length === 3 ? body.currency.toUpperCase() : "USD";
  let startDate: Date | null = new Date();
  if (body.startDate) {
    startDate = new Date(body.startDate);
    if (isNaN(startDate.getTime())) return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }

  const count = await prisma.offer.count({ where: { tenantId: ctx.tenantId } });
  const number = offerNumber(count + 1, new Date().getFullYear());

  const offer = await prisma.offer.create({
    data: {
      tenantId: ctx.tenantId,
      number,
      candidateId: body.candidateId,
      requisitionId: body.requisitionId ?? null,
      templateId,
      jobTitle: body.jobTitle.trim(),
      grade: typeof body.grade === "string" ? body.grade : null,
      employmentType: body.employmentType ?? null,
      location: typeof body.location === "string" ? body.location : null,
      workMode: body.workMode ?? null,
      startDate,
      baseCompCents: BigInt(body.baseCompCents),
      variableCents: body.variableCents !== undefined && body.variableCents !== null ? BigInt(body.variableCents) : null,
      currency,
      notes: typeof body.notes === "string" ? body.notes : null,
      status: "draft",
      createdBy: ctx.userId,
    },
  });
  return NextResponse.json({ offer: serializeOffer(offer) }, { status: 201 });
}
