import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const contact = await prisma.crmContact.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!contact) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_CONTACT_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_contact",
    id,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const account = await prisma.crmAccount.findFirst({ where: { id: contact.accountId, tenantId: ctx.tenantId }, select: { id: true, name: true } });
  return NextResponse.json({ contact: { ...contact, accountName: account?.name ?? null } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const contact = await prisma.crmContact.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!contact) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_CONTACT_UPDATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_contact",
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
  if (body.fullName !== undefined) {
    if (!body.fullName) return NextResponse.json({ error: "Missing fullName" }, { status: 400 });
    data.fullName = body.fullName;
  }
  if (body.email !== undefined) {
    if (!body.email) return NextResponse.json({ error: "Missing email" }, { status: 400 });
    data.email = body.email;
  }
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.title !== undefined) data.title = body.title;
  if (body.isPrimary !== undefined) data.isPrimary = Boolean(body.isPrimary);
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.accountId !== undefined) {
    const accountOk = await prisma.crmAccount.findFirst({ where: { id: body.accountId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!accountOk) return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
    data.accountId = body.accountId;
  }

  const updated = await prisma.crmContact.update({ where: { id }, data });
  return NextResponse.json({ contact: updated });
}
