import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUSES, parseBudgetToCents, isValidCents } from "@/features/projects/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.PROJECT_READ, {
    tenantId: ctx.tenantId,
    resourceType: "project",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  const where: any = { tenantId: ctx.tenantId };
  if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) where.status = status;

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.project.count({ where }),
  ]);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  const empIds = Array.from(new Set(pageRows.flatMap((p) => [p.ownerId, p.deliveryLeadId].filter((x): x is string => !!x))));
  const emps = empIds.length
    ? await prisma.employee.findMany({ where: { id: { in: empIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } })
    : [];
  const empName = new Map(emps.map((e) => [e.id, e.displayName]));

  const projects = pageRows.map((p) => ({
    ...p,
    budgetCents: p.budgetCents !== null ? String(p.budgetCents) : null,
    ownerName: empName.get(p.ownerId) ?? null,
    deliveryLeadName: p.deliveryLeadId ? (empName.get(p.deliveryLeadId) ?? null) : null,
  }));
  return NextResponse.json({ projects, page, pageSize, total, hasMore });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.PROJECT_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "project",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") return NextResponse.json({ error: "Missing name" }, { status: 400 });
  if (!body.code || typeof body.code !== "string") return NextResponse.json({ error: "Missing code" }, { status: 400 });
  if (!body.ownerId) return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });

  const [ownerOk, leadOk, acctOk, codeDup] = await Promise.all([
    prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } }),
    body.deliveryLeadId ? prisma.employee.findFirst({ where: { id: body.deliveryLeadId, tenantId: ctx.tenantId }, select: { id: true } }) : Promise.resolve({ id: "skip" }),
    body.accountId ? prisma.crmAccount.findFirst({ where: { id: body.accountId, tenantId: ctx.tenantId }, select: { id: true } }) : Promise.resolve({ id: "skip" }),
    prisma.project.findFirst({ where: { code: body.code, tenantId: ctx.tenantId }, select: { id: true } }),
  ]);
  if (!ownerOk) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });
  if (!leadOk) return NextResponse.json({ error: "Invalid deliveryLeadId" }, { status: 400 });
  if (!acctOk) return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
  if (codeDup) return NextResponse.json({ error: "Code already exists in tenant" }, { status: 409 });

  let budgetCents: number | null = null;
  if (body.budget !== undefined && body.budget !== null && body.budget !== "") {
    budgetCents = parseBudgetToCents(String(body.budget));
    if (budgetCents === null || !isValidCents(budgetCents)) return NextResponse.json({ error: "Invalid budget (use decimal with up to 2 places)" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      tenantId: ctx.tenantId,
      name: body.name,
      code: body.code,
      accountId: body.accountId ?? null,
      ownerId: body.ownerId,
      deliveryLeadId: body.deliveryLeadId ?? null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      budgetCents,
      status: "proposed",
      description: body.description ?? null,
    },
  });
  return NextResponse.json({ project: { ...project, budgetCents: project.budgetCents !== null ? String(project.budgetCents) : null } }, { status: 201 });
}
