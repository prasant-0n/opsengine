import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_LEAD_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_lead",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  const where: any = { tenantId: ctx.tenantId };
  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) where.status = status;

  const [rows, total] = await Promise.all([
    prisma.crmLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.crmLead.count({ where }),
  ]);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const ownerIds = Array.from(new Set(pageRows.map((r) => r.ownerId)));
  const owners = ownerIds.length
    ? await prisma.employee.findMany({ where: { id: { in: ownerIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } })
    : [];
  const ownerName = new Map(owners.map((o) => [o.id, o.displayName]));
  const leads = pageRows.map((r) => ({ ...r, ownerName: ownerName.get(r.ownerId) ?? null }));
  return NextResponse.json({ leads, page, pageSize, total, hasMore });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_LEAD_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_lead",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.fullName || typeof body.fullName !== "string") return NextResponse.json({ error: "Missing fullName" }, { status: 400 });
  const source = typeof body.source === "string" && body.source ? body.source : "inbound";
  if (!(LEAD_SOURCES as readonly string[]).includes(source)) return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  if (!body.ownerId) return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });
  const ownerOk = await prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!ownerOk) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });

  const lead = await prisma.crmLead.create({
    data: {
      tenantId: ctx.tenantId,
      fullName: body.fullName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      company: body.company ?? null,
      source,
      status: "new",
      ownerId: body.ownerId,
      nextAction: body.nextAction ?? null,
      nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json({ lead }, { status: 201 });
}
