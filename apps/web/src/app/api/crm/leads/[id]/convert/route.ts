import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, writeAudit } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isValidConvertTarget, isValidCents } from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const lead = await prisma.crmLead.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!lead) notFound();

  const authz = authorize(
    ctx,
    PERMISSIONS.CRM_LEAD_CONVERT,
    { tenantId: ctx.tenantId, resourceType: "crm_lead", id },
    { audit: true },
  );
  if (!authz.allowed) {
    writeAudit({ tenantId: ctx.tenantId, actorUserId: ctx.userId, eventType: "crm.lead.convert", resourceType: "crm_lead", resourceId: id, decision: "deny", reasonCode: "DENIED" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (lead.status === "converted") {
    return NextResponse.json({ error: "Lead already converted", code: "ALREADY_CONVERTED" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}) as any);
  const target = body.target;
  if (!isValidConvertTarget(target)) {
    return NextResponse.json({ error: "Invalid target (account | opportunity | both)" }, { status: 400 });
  }

  let accountId: string | null = null;
  let opportunityId: string | null = null;
  let contactId: string | null = null;

  if (target === "account" || target === "both") {
    const account = await prisma.crmAccount.create({
      data: {
        tenantId: ctx.tenantId,
        name: lead.company || lead.fullName,
        source: lead.source,
        status: "prospect",
        ownerId: lead.ownerId,
        notes: lead.notes ?? null,
      },
    });
    accountId = account.id;
    const contact = await prisma.crmContact.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: account.id,
        fullName: lead.fullName,
        email: lead.email ?? "",
        phone: lead.phone ?? null,
        title: null,
        isPrimary: true,
        notes: "Converted from lead",
      },
    });
    contactId = contact.id;
  }

  if (target === "opportunity" || target === "both") {
    if (target === "opportunity") {
      if (!body.accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
      const accountOk = await prisma.crmAccount.findFirst({ where: { id: body.accountId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!accountOk) return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
      accountId = body.accountId;
    }
    const oppBody = body.opportunity ?? {};
    if (!oppBody.name || typeof oppBody.name !== "string") return NextResponse.json({ error: "Missing opportunity.name" }, { status: 400 });
    if (!isValidCents(oppBody.amountCents)) return NextResponse.json({ error: "Invalid opportunity.amountCents (integer cents required)" }, { status: 400 });
    const currency = typeof oppBody.currency === "string" && /^[A-Z]{3}$/.test(oppBody.currency) ? oppBody.currency : "USD";

    const opp = await prisma.crmOpportunity.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: accountId!,
        name: oppBody.name,
        stage: "prospecting",
        amountCents: BigInt(oppBody.amountCents),
        currency,
        expectedCloseDate: oppBody.expectedCloseDate ? new Date(oppBody.expectedCloseDate) : null,
        probability: typeof oppBody.probability === "number" ? oppBody.probability : null,
        forecastCategory: "pipeline",
        ownerId: lead.ownerId,
      },
    });
    opportunityId = opp.id;
    await prisma.stageHistory.create({
      data: { tenantId: ctx.tenantId, entityType: "opportunity", entityId: opp.id, fromStatus: null, toStatus: "prospecting", actorId: ctx.userId, reason: `converted from lead ${id}` },
    });
  }

  const updated = await prisma.crmLead.update({
    where: { id },
    data: {
      status: "converted",
      convertedAccountId: accountId,
      convertedContactId: contactId,
      convertedOpportunityId: opportunityId,
    },
  });

  await prisma.stageHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityType: "lead",
      entityId: id,
      fromStatus: lead.status,
      toStatus: "converted",
      actorId: ctx.userId,
      reason: `target: ${target}`,
    },
  });

  writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    eventType: "crm.lead.convert",
    resourceType: "crm_lead",
    resourceId: id,
    decision: "allow",
    reasonCode: `TARGET_${target.toUpperCase()}`,
  });

  return NextResponse.json({ lead: updated, accountId, opportunityId, contactId }, { status: 201 });
}
