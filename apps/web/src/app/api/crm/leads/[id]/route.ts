import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionLead, LEAD_SOURCES, LEAD_STATUSES } from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const lead = await prisma.crmLead.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!lead) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_LEAD_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_lead",
    id,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [owner, history] = await Promise.all([
    prisma.employee.findFirst({ where: { id: lead.ownerId, tenantId: ctx.tenantId }, select: { id: true, displayName: true } }),
    prisma.stageHistory.findMany({
      where: { tenantId: ctx.tenantId, entityType: "lead", entityId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return NextResponse.json({ lead: { ...lead, ownerName: owner?.displayName ?? null }, history });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const lead = await prisma.crmLead.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!lead) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_LEAD_UPDATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_lead",
    id,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== undefined) {
    if (body.status === "converted") {
      return NextResponse.json(
        { error: "Use POST /convert for governed conversions", code: "GOVERNED_ACTION" },
        { status: 400 },
      );
    }
    if (!(LEAD_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (!canTransitionLead(lead.status as any, body.status as any)) {
      return NextResponse.json({ error: "Transition not allowed", code: "INVALID_TRANSITION" }, { status: 400 });
    }
  }

  const data: any = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.fullName !== undefined) {
    if (!body.fullName) return NextResponse.json({ error: "Missing fullName" }, { status: 400 });
    data.fullName = body.fullName;
  }
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.company !== undefined) data.company = body.company;
  if (body.source !== undefined) {
    if (!(LEAD_SOURCES as readonly string[]).includes(body.source)) return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    data.source = body.source;
  }
  if (body.nextAction !== undefined) data.nextAction = body.nextAction;
  if (body.nextActionAt !== undefined) data.nextActionAt = body.nextActionAt ? new Date(body.nextActionAt) : null;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.ownerId !== undefined) {
    const ownerOk = await prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ownerOk) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });
    data.ownerId = body.ownerId;
  }

  const updated = await prisma.crmLead.update({ where: { id }, data });
  if (body.status !== undefined && body.status !== lead.status) {
    await prisma.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "lead",
        entityId: id,
        fromStatus: lead.status,
        toStatus: body.status,
        actorId: ctx.userId,
        reason: "status change",
      },
    });
  }
  return NextResponse.json({ lead: updated });
}
