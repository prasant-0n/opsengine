import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionRequisition, REQUISITION_STATUSES } from "@/features/recruitment/lib/recruitment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.RECRUIT_REQUISITION_READ, {
    tenantId: ctx.tenantId,
    resourceType: "requisition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  const where: any = { tenantId: ctx.tenantId };
  if (status && (REQUISITION_STATUSES as readonly string[]).includes(status)) {
    where.status = status;
  }

  const [rows, total] = await Promise.all([
    prisma.requisition.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.requisition.count({ where }),
  ]);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const managerIds = Array.from(new Set(pageRows.map((r) => r.hiringManagerId).filter(Boolean))) as string[];
  const managers = managerIds.length
    ? await prisma.employee.findMany({ where: { id: { in: managerIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } })
    : [];
  const managerName = new Map(managers.map((m) => [m.id, m.displayName]));
  const enriched = pageRows.map((r) => ({ ...r, hiringManagerName: r.hiringManagerId ? (managerName.get(r.hiringManagerId) ?? null) : null }));
  return NextResponse.json({ requisitions: enriched, page, pageSize, total, hasMore });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.RECRUIT_REQUISITION_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "requisition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = ["jobTitle"];
  for (const k of required) if (!body[k]) return NextResponse.json({ error: `Missing ${k}` }, { status: 400 });

  if (body.hiringManagerId) {
    const empOk = await prisma.employee.findFirst({ where: { id: body.hiringManagerId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!empOk) return NextResponse.json({ error: "Invalid hiringManagerId" }, { status: 400 });
  }

  const requisition = await prisma.requisition.create({
    data: {
      tenantId: ctx.tenantId,
      jobTitle: body.jobTitle,
      jobFamily: body.jobFamily ?? null,
      grade: body.grade ?? null,
      headcount: Number(body.headcount ?? 1),
      budgetBand: body.budgetBand ?? null,
      hiringManagerId: body.hiringManagerId ?? null,
      justification: body.justification ?? null,
      expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : null,
      status: "draft",
      createdBy: ctx.userId,
    },
  });

  await prisma.stageHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityType: "requisition",
      entityId: requisition.id,
      fromStatus: null,
      toStatus: "draft",
      actorId: ctx.userId,
      reason: "created",
    },
  });

  return NextResponse.json({ requisition }, { status: 201 });
}
