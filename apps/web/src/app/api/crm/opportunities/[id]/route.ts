import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  canTransitionOpportunity,
  FORECAST_CATEGORIES,
  formatCents,
  isGovernedOpportunityStage,
  isValidCents,
  isValidProbability,
} from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const opportunity = await prisma.crmOpportunity.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!opportunity) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_OPPORTUNITY_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_opportunity",
    id,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [account, owner, history] = await Promise.all([
    prisma.crmAccount.findFirst({ where: { id: opportunity.accountId, tenantId: ctx.tenantId }, select: { id: true, name: true } }),
    prisma.employee.findFirst({ where: { id: opportunity.ownerId, tenantId: ctx.tenantId }, select: { id: true, displayName: true } }),
    prisma.stageHistory.findMany({
      where: { tenantId: ctx.tenantId, entityType: "opportunity", entityId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    opportunity: {
      ...opportunity,
      amountCents: opportunity.amountCents.toString(),
      amountFormatted: formatCents(opportunity.amountCents, opportunity.currency),
      accountName: account?.name ?? null,
      ownerName: owner?.displayName ?? null,
    },
    history,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const opportunity = await prisma.crmOpportunity.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!opportunity) notFound();

  const authz = authorize(ctx, PERMISSIONS.CRM_OPPORTUNITY_UPDATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_opportunity",
    id,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.stage !== undefined) {
    if (isGovernedOpportunityStage(body.stage)) {
      return NextResponse.json(
        { error: "Use POST /outcome for governed outcomes", code: "GOVERNED_ACTION" },
        { status: 400 },
      );
    }
    if (!canTransitionOpportunity(opportunity.stage as any, body.stage)) {
      return NextResponse.json({ error: "Transition not allowed", code: "INVALID_TRANSITION" }, { status: 400 });
    }
  }
  if (body.lostReason !== undefined || body.competitorNotes !== undefined) {
    return NextResponse.json(
      { error: "Use POST /outcome for governed outcome fields", code: "GOVERNED_ACTION" },
      { status: 400 },
    );
  }
  if (body.amountCents !== undefined && (!isValidCents(body.amountCents) || Number(BigInt(body.amountCents)) < 0)) {
    return NextResponse.json({ error: "Invalid amountCents (non-negative integer cents required)" }, { status: 400 });
  }
  if (body.probability !== undefined && body.probability !== null && !isValidProbability(body.probability)) {
    return NextResponse.json({ error: "Invalid probability (0-100 integer)" }, { status: 400 });
  }
  if (body.forecastCategory !== undefined && body.forecastCategory !== null && !(FORECAST_CATEGORIES as readonly string[]).includes(body.forecastCategory)) {
    return NextResponse.json({ error: "Invalid forecastCategory" }, { status: 400 });
  }

  const data: any = {};
  if (body.name !== undefined) {
    if (!body.name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
    data.name = body.name;
  }
  if (body.stage !== undefined) data.stage = body.stage;
  if (body.amountCents !== undefined) data.amountCents = BigInt(body.amountCents);
  if (body.currency !== undefined) {
    if (!/^[A-Z]{3}$/.test(body.currency)) return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    data.currency = body.currency;
  }
  if (body.expectedCloseDate !== undefined) data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
  if (body.probability !== undefined) data.probability = body.probability;
  if (body.forecastCategory !== undefined) data.forecastCategory = body.forecastCategory;
  if (body.accountId !== undefined) {
    const accountOk = await prisma.crmAccount.findFirst({ where: { id: body.accountId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!accountOk) return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
    data.accountId = body.accountId;
  }
  if (body.ownerId !== undefined) {
    const ownerOk = await prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ownerOk) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });
    data.ownerId = body.ownerId;
  }

  const updated = await prisma.crmOpportunity.update({ where: { id }, data });
  if (body.stage !== undefined && body.stage !== opportunity.stage) {
    await prisma.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "opportunity",
        entityId: id,
        fromStatus: opportunity.stage,
        toStatus: body.stage,
        actorId: ctx.userId,
        reason: "stage change",
      },
    });
  }
  return NextResponse.json({ opportunity: { ...updated, amountCents: updated.amountCents.toString() } });
}
