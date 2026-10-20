import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_CONTACT_READ, {
    tenantId: ctx.tenantId,
    resourceType: "crm_contact",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const accountId = (searchParams.get("accountId") ?? "").trim();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  const where: any = { tenantId: ctx.tenantId };
  if (accountId) where.accountId = accountId;

  const [rows, total] = await Promise.all([
    prisma.crmContact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.crmContact.count({ where }),
  ]);
  const hasMore = rows.length > pageSize;
  const contacts = hasMore ? rows.slice(0, pageSize) : rows;
  return NextResponse.json({ contacts, page, pageSize, total, hasMore });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CRM_CONTACT_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "crm_contact",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.fullName || typeof body.fullName !== "string") return NextResponse.json({ error: "Missing fullName" }, { status: 400 });
  if (!body.email || typeof body.email !== "string") return NextResponse.json({ error: "Missing email" }, { status: 400 });
  if (!body.accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  const accountOk = await prisma.crmAccount.findFirst({ where: { id: body.accountId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!accountOk) return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });

  const contact = await prisma.crmContact.create({
    data: {
      tenantId: ctx.tenantId,
      accountId: body.accountId,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      title: body.title ?? null,
      isPrimary: Boolean(body.isPrimary),
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json({ contact }, { status: 201 });
}
