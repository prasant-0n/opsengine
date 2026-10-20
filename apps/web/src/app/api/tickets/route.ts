import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  TICKET_STATUSES,
  TICKET_TYPES,
  TICKET_PRIORITIES,
  isValidTicketType,
  isValidTicketPriority,
} from "@/features/projects/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TICKET_READ, {
    tenantId: ctx.tenantId,
    resourceType: "ticket",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const projectId = (searchParams.get("projectId") ?? "").trim();
  const assigneeId = (searchParams.get("assigneeId") ?? "").trim();
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 100);

  const where: any = { tenantId: ctx.tenantId };
  if (status && (TICKET_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (projectId) where.projectId = projectId;
  if (assigneeId) where.assigneeId = assigneeId;

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    }),
    prisma.ticket.count({ where }),
  ]);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  const empIds = Array.from(new Set(pageRows.flatMap((t) => [t.assigneeId, t.reporterId].filter((x): x is string => !!x))));
  const projIds = Array.from(new Set(pageRows.map((t) => t.projectId).filter((x): x is string => !!x)));
  const [emps, projs] = await Promise.all([
    empIds.length ? prisma.employee.findMany({ where: { id: { in: empIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } }) : [],
    projIds.length ? prisma.project.findMany({ where: { id: { in: projIds }, tenantId: ctx.tenantId }, select: { id: true, name: true, code: true } }) : [],
  ]);
  const empName = new Map(emps.map((e) => [e.id, e.displayName]));
  const projName = new Map(projs.map((p) => [p.id, `${p.code} · ${p.name}`]));

  const tickets = pageRows.map((t) => ({
    ...t,
    assigneeName: t.assigneeId ? (empName.get(t.assigneeId) ?? null) : null,
    reporterName: t.reporterId ? (empName.get(t.reporterId) ?? null) : null,
    projectName: t.projectId ? (projName.get(t.projectId) ?? null) : null,
  }));
  return NextResponse.json({ tickets, page, pageSize, total, hasMore });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TICKET_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "ticket",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || typeof body.title !== "string") return NextResponse.json({ error: "Missing title" }, { status: 400 });
  const type = typeof body.type === "string" && body.type ? body.type : "task";
  if (!isValidTicketType(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  const priority = typeof body.priority === "string" && body.priority ? body.priority : "medium";
  if (!isValidTicketPriority(priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });

  if (body.projectId) {
    const projOk = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!projOk) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }
  if (body.assigneeId) {
    const empOk = await prisma.employee.findFirst({ where: { id: body.assigneeId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!empOk) return NextResponse.json({ error: "Invalid assigneeId" }, { status: 400 });
  }

  const ticket = await prisma.ticket.create({
    data: {
      tenantId: ctx.tenantId,
      projectId: body.projectId ?? null,
      title: body.title,
      description: body.description ?? null,
      type,
      status: "open",
      priority,
      assigneeId: body.assigneeId ?? null,
      reporterId: ctx.userId,
    },
  });
  return NextResponse.json({ ticket }, { status: 201 });
}
