import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOfferAuthz, isResponse } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_READ, { resourceType: "offer_template" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const active = searchParams.get("active");

  const where: any = { tenantId: ctx.tenantId };
  if (active === "1") where.active = true;

  const templates = await prisma.offerTemplate.findMany({
    where,
    orderBy: [{ name: "asc" }, { version: "desc" }],
    take: 200,
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_CREATE, { resourceType: "offer_template" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.body || typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (body.defaultTermsDays !== undefined && body.defaultTermsDays !== null) {
    if (!Number.isInteger(body.defaultTermsDays) || body.defaultTermsDays < 0) {
      return NextResponse.json({ error: "defaultTermsDays must be a non-negative integer" }, { status: 400 });
    }
  }

  const name = body.name.trim();
  const existing = await prisma.offerTemplate.findFirst({
    where: { tenantId: ctx.tenantId, name },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = existing ? existing.version + 1 : 1;

  const template = await prisma.offerTemplate.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      jobFamily: typeof body.jobFamily === "string" ? body.jobFamily : null,
      employmentType: typeof body.employmentType === "string" ? body.employmentType : null,
      body: body.body,
      defaultTermsDays: body.defaultTermsDays ?? null,
      active: true,
      version,
      createdBy: ctx.userId,
    },
  });
  return NextResponse.json({ template }, { status: 201 });
}
