import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_STATUSES, CLIENT_TIERS } from "@/features/crm/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_ACCOUNT_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_account",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  const where: any = { tenantId: ctx.tenantId };
  if (status && (ACCOUNT_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.crmAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.crmAccount.count({ where }),
  ]);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const ownerIds = Array.from(new Set(pageRows.map((r) => r.ownerId)));
  const owners = ownerIds.length
    ? await prisma.employee.findMany({ where: { id: { in: ownerIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } })
    : [];
  const ownerName = new Map(owners.map((o) => [o.id, o.displayName]));
  const accounts = pageRows.map((r) => ({ ...r, ownerName: ownerName.get(r.ownerId) ?? null }));
  return NextResponse.json({ accounts, page, pageSize, total, hasMore });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_ACCOUNT_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_account",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const status = body.status ?? "prospect";
  if (!(ACCOUNT_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (body.clientTier && !(CLIENT_TIERS as readonly string[]).includes(body.clientTier)) return NextResponse.json({ error: "Invalid clientTier" }, { status: 400 });
  if (!body.ownerId) return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });
  const ownerOk = await prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!ownerOk) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });

  const account = await prisma.crmAccount.create({
    data: {
      tenantId: ctx.tenantId,
      name: body.name,
      industry: body.industry ?? null,
      website: body.website ?? null,
      source: typeof body.source === "string" && body.source ? body.source : "inbound",
      status,
      clientTier: body.clientTier ?? null,
      ownerId: body.ownerId,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json({ account }, { status: 201 });
}
