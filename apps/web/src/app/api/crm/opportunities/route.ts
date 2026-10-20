import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  FORECAST_CATEGORIES,
  formatCents,
  isValidCents,
  isValidProbability,
  OPPORTUNITY_STAGES,
} from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_OPPORTUNITY_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_opportunity",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const stage = (searchParams.get("stage") ?? "").trim();
  const accountId = (searchParams.get("accountId") ?? "").trim();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  const where: any = { tenantId: ctx.tenantId };
  if (stage && (OPPORTUNITY_STAGES as readonly string[]).includes(stage)) where.stage = stage;
  if (accountId) where.accountId = accountId;

  const [rows, total] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.crmOpportunity.count({ where }),
  ]);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  const accountIds = Array.from(new Set(pageRows.map((r) => r.accountId)));
  const ownerIds = Array.from(new Set(pageRows.map((r) => r.ownerId)));
  const [accounts, owners] = await Promise.all([
    accountIds.length
      ? prisma.crmAccount.findMany({ where: { id: { in: accountIds }, tenantId: ctx.tenantId }, select: { id: true, name: true } })
      : Promise.resolve([]),
    ownerIds.length
      ? prisma.employee.findMany({ where: { id: { in: ownerIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } })
      : Promise.resolve([]),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const ownerName = new Map(owners.map((o) => [o.id, o.displayName]));

  const opportunities = pageRows.map((r) => ({
    ...r,
    amountCents: r.amountCents.toString(),
    amountFormatted: formatCents(r.amountCents, r.currency),
    accountName: accountName.get(r.accountId) ?? null,
    ownerName: ownerName.get(r.ownerId) ?? null,
  }));

  return NextResponse.json({ opportunities, page, pageSize, total, hasMore });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_OPPORTUNITY_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_opportunity",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  const accountOk = await prisma.crmAccount.findFirst({ where: { id: body.accountId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!accountOk) return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
  if (!body.name || typeof body.name !== "string") return NextResponse.json({ error: "Missing name" }, { status: 400 });
  if (!isValidCents(body.amountCents) || Number(BigInt(body.amountCents)) < 0) {
    return NextResponse.json({ error: "Invalid amountCents (non-negative integer cents required)" }, { status: 400 });
  }
  const stage = body.stage ?? "prospecting";
  if (!(OPPORTUNITY_STAGES as readonly string[]).includes(stage) || stage === "won" || stage === "lost") {
    return NextResponse.json({ error: "Invalid stage (won/lost are governed outcomes)" }, { status: 400 });
  }
  if (body.probability !== undefined && body.probability !== null && !isValidProbability(body.probability)) {
    return NextResponse.json({ error: "Invalid probability (0-100 integer)" }, { status: 400 });
  }
  if (body.forecastCategory !== undefined && body.forecastCategory !== null && !(FORECAST_CATEGORIES as readonly string[]).includes(body.forecastCategory)) {
    return NextResponse.json({ error: "Invalid forecastCategory" }, { status: 400 });
  }
  if (!body.ownerId) return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });
  const ownerOk = await prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!ownerOk) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });
  const currency = typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) ? body.currency : "USD";

  const opportunity = await prisma.crmOpportunity.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: body.accountId,
      name: body.name,
      stage,
      amountCents: BigInt(body.amountCents),
      currency,
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
      probability: body.probability ?? null,
      forecastCategory: body.forecastCategory ?? null,
      ownerId: body.ownerId,
    },
  });

  await prisma.stageHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityType: "opportunity",
      entityId: opportunity.id,
      fromStatus: null,
      toStatus: stage,
      actorId: ctx.userId,
      reason: "created",
    },
  });

  return NextResponse.json({ opportunity: { ...opportunity, amountCents: opportunity.amountCents.toString() } }, { status: 201 });
}
