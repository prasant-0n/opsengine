import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, writeAudit } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const opportunity = await prisma.crmOpportunity.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!opportunity) notFound();

  const authz = authorize(
    ctx,
    PERMISSIONS.CRM_OPPORTUNITY_APPROVE_STAGE,
    { tenantId: ctx.tenantId, resourceType: "crm_opportunity", id },
    { audit: true },
  );
  if (!authz.allowed) {
    writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      eventType: "crm.opportunity.outcome",
      resourceType: "crm_opportunity",
      resourceId: id,
      decision: "deny",
      reasonCode: "DENIED",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (opportunity.stage === "won" || opportunity.stage === "lost") {
    return NextResponse.json({ error: "Outcome already recorded", code: "ALREADY_CLOSED" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}) as any);
  const action = body.action;
  if (action !== "won" && action !== "lost") {
    return NextResponse.json({ error: "Invalid action (won | lost)" }, { status: 400 });
  }

  const data = {
    stage: action,
    forecastCategory: action === "won" ? "closed" : opportunity.forecastCategory,
    lostReason: action === "lost" ? (body.reason ?? null) : opportunity.lostReason,
    competitorNotes:
      body.competitorNotes !== undefined
        ? body.competitorNotes
        : action === "lost"
          ? opportunity.competitorNotes
          : opportunity.competitorNotes,
  };
  if (action === "lost" && (!body.reason || typeof body.reason !== "string")) {
    return NextResponse.json({ error: "Lost outcome requires a reason" }, { status: 400 });
  }

  const updated = await prisma.crmOpportunity.update({ where: { id }, data });

  await prisma.stageHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityType: "opportunity",
      entityId: id,
      fromStatus: opportunity.stage,
      toStatus: action,
      actorId: ctx.userId,
      reason: action === "lost" ? String(body.reason) : (body.reason ?? "won"),
    },
  });

  writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    eventType: "crm.opportunity.outcome",
    resourceType: "crm_opportunity",
    resourceId: id,
    decision: "allow",
    reasonCode: action.toUpperCase(),
  });

  return NextResponse.json({
    opportunity: {
      ...updated,
      amountCents: updated.amountCents.toString(),
      amountFormatted: formatCents(updated.amountCents, updated.currency),
    },
  });
}
