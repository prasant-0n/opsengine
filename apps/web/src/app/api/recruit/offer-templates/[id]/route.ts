import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOfferAuthz, isResponse } from "../../_lib";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_READ, { resourceType: "offer_template" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const template = await prisma.offerTemplate.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_CREATE, { resourceType: "offer_template" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const template = await prisma.offerTemplate.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Toggle active only (no body-content edits here): content edits create a new version via POST.
  if (typeof body.active === "boolean") {
    const updated = await prisma.offerTemplate.update({ where: { id: template.id }, data: { active: body.active } });
    return NextResponse.json({ template: updated });
  }

  return NextResponse.json({ error: "Only {active} may be patched; create a new version to change content" }, { status: 400 });
}
