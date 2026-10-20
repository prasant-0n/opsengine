import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  canTransitionTicket,
  isValidTicketStatus,
  isValidTicketType,
  isValidTicketPriority,
  isGovernedTicketStatus,
} from "@/features/projects/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TICKET_READ, {
    tenantId: ctx.tenantId,
    resourceType: "ticket",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ticket = await prisma.ticket.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [history, employees, project] = await Promise.all([
    prisma.stageHistory.findMany({ where: { tenantId: ctx.tenantId, entityType: "ticket", entityId: id }, orderBy: { createdAt: "desc" } }),
    prisma.employee.findMany({
      where: { id: { in: Array.from(new Set([ticket.assigneeId, ticket.reporterId].filter((x): x is string => !!x))) }, tenantId: ctx.tenantId },
      select: { id: true, displayName: true },
    }),
    ticket.projectId ? prisma.project.findFirst({ where: { id: ticket.projectId, tenantId: ctx.tenantId }, select: { id: true, name: true, code: true } }) : Promise.resolve(null),
  ]);
  const empName = new Map(employees.map((e) => [e.id, e.displayName]));

  return NextResponse.json({
    ticket,
    projectName: project ? `${project.code} · ${project.name}` : null,
    assigneeName: ticket.assigneeId ? (empName.get(ticket.assigneeId) ?? null) : null,
    reporterName: ticket.reporterId ? (empName.get(ticket.reporterId) ?? null) : null,
    history,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TICKET_UPDATE, {
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

  const ticket = await prisma.ticket.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.type !== undefined) {
    if (!isValidTicketType(body.type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    data.type = body.type;
  }
  if (body.priority !== undefined) {
    if (!isValidTicketPriority(body.priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    data.priority = body.priority;
  }
  if (body.assigneeId !== undefined) {
    if (body.assigneeId) {
      const ok = await prisma.employee.findFirst({ where: { id: body.assigneeId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Invalid assigneeId" }, { status: 400 });
    }
    data.assigneeId = body.assigneeId ?? null;
  }
  if (body.projectId !== undefined) {
    if (body.projectId) {
      const ok = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }
    data.projectId = body.projectId ?? null;
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isValidTicketStatus(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    if (isGovernedTicketStatus(body.status)) {
      return NextResponse.json(
        { error: "Governed transition requires dedicated POST endpoint", code: "GOVERNED_ACTION" },
        { status: 400 }
      );
    }
    if (!canTransitionTicket(ticket.status as any, body.status)) {
      return NextResponse.json({ error: `Invalid transition ${ticket.status} → ${body.status}` }, { status: 400 });
    }
    data.status = body.status;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id }, data });
    if (body.status !== undefined && body.status !== ticket.status) {
      await tx.stageHistory.create({
        data: {
          tenantId: ctx.tenantId,
          entityType: "ticket",
          entityId: id,
          fromStatus: ticket.status,
          toStatus: body.status,
          actorId: ctx.userId,
        },
      });
    }
    return u;
  });
  return NextResponse.json({ ticket: updated });
}
