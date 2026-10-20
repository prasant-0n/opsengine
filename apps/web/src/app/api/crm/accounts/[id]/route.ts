import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_STATUSES, CLIENT_TIERS, formatCents } from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const account = await prisma.crmAccount.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!account) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_ACCOUNT_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_account",
    id,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [contacts, opportunities, owner] = await Promise.all([
    prisma.crmContact.findMany({ where: { accountId: id, tenantId: ctx.tenantId }, orderBy: { createdAt: "asc" } }),
    prisma.crmOpportunity.findMany({ where: { accountId: id, tenantId: ctx.tenantId }, orderBy: { createdAt: "desc" } }),
    prisma.employee.findFirst({ where: { id: account.ownerId, tenantId: ctx.tenantId }, select: { id: true, displayName: true } }),
  ]);
  const opps = opportunities.map((o) => ({
    ...o,
    amountCents: o.amountCents.toString(),
    amountFormatted: formatCents(o.amountCents, o.currency),
  }));

  return NextResponse.json({
    account: { ...account, ownerName: owner?.displayName ?? null },
    contacts,
    opportunities: opps,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const account = await prisma.crmAccount.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!account) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_ACCOUNT_UPDATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_account",
    id,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: any = {};
  if (body.name !== undefined) {
    if (!body.name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
    data.name = body.name;
  }
  if (body.status !== undefined) {
    if (!(ACCOUNT_STATUSES as readonly string[]).includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    data.status = body.status;
  }
  if (body.clientTier !== undefined) {
    if (body.clientTier !== null && !(CLIENT_TIERS as readonly string[]).includes(body.clientTier)) return NextResponse.json({ error: "Invalid clientTier" }, { status: 400 });
    data.clientTier = body.clientTier;
  }
  if (body.industry !== undefined) data.industry = body.industry;
  if (body.website !== undefined) data.website = body.website;
  if (body.source !== undefined) data.source = body.source;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.ownerId !== undefined) {
    const ownerOk = await prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ownerOk) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });
    data.ownerId = body.ownerId;
  }

  const updated = await prisma.crmAccount.update({ where: { id }, data });
  return NextResponse.json({ account: updated });
}
