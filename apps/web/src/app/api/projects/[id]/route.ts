import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  canTransitionProject,
  isValidProjectStatus,
  isGovernedProjectStatus,
  parseBudgetToCents,
  isValidCents,
} from "@/features/projects/lib/projects";

export const dynamic = "force-dynamic";

function serialize(p: any) {
  return { ...p, budgetCents: p.budgetCents !== null && p.budgetCents !== undefined ? String(p.budgetCents) : null };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.PROJECT_READ, {
    tenantId: ctx.tenantId,
    resourceType: "project",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const project = await prisma.project.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [milestones, allocations, tickets, history, account] = await Promise.all([
    prisma.projectMilestone.findMany({ where: { tenantId: ctx.tenantId, projectId: id }, orderBy: { dueDate: "asc" } }),
    prisma.allocation.findMany({ where: { tenantId: ctx.tenantId, projectId: id }, orderBy: { startDate: "asc" } }),
    prisma.ticket.findMany({ where: { tenantId: ctx.tenantId, projectId: id }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.stageHistory.findMany({ where: { tenantId: ctx.tenantId, entityType: "project", entityId: id }, orderBy: { createdAt: "desc" } }),
    project.accountId ? prisma.crmAccount.findFirst({ where: { id: project.accountId, tenantId: ctx.tenantId }, select: { id: true, name: true } }) : Promise.resolve(null),
  ]);
  const empIds = Array.from(
    new Set([project.ownerId, project.deliveryLeadId, ...allocations.map((a) => a.employeeId)].filter((x): x is string => !!x))
  );
  const employees = empIds.length
    ? await prisma.employee.findMany({ where: { id: { in: empIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } })
    : [];
  const empName = new Map(employees.map((e) => [e.id, e.displayName]));

  return NextResponse.json({
    project: serialize(project),
    accountName: account?.name ?? null,
    ownerName: empName.get(project.ownerId) ?? null,
    deliveryLeadName: project.deliveryLeadId ? (empName.get(project.deliveryLeadId) ?? null) : null,
    milestones,
    allocations: allocations.map((a) => ({ ...a, employeeName: empName.get(a.employeeId) ?? null })),
    tickets,
    history,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.PROJECT_UPDATE, {
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

  const project = await prisma.project.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.deliveryLeadId !== undefined) {
    if (body.deliveryLeadId) {
      const ok = await prisma.employee.findFirst({ where: { id: body.deliveryLeadId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Invalid deliveryLeadId" }, { status: 400 });
    }
    data.deliveryLeadId = body.deliveryLeadId ?? null;
  }
  if (body.ownerId !== undefined) {
    const ok = await prisma.employee.findFirst({ where: { id: body.ownerId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ok) return NextResponse.json({ error: "Invalid ownerId" }, { status: 400 });
    data.ownerId = body.ownerId;
  }
  if (body.budget !== undefined) {
    if (body.budget === null || body.budget === "") data.budgetCents = null;
    else {
      const cents = parseBudgetToCents(String(body.budget));
      if (cents === null || !isValidCents(cents)) return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
      data.budgetCents = cents;
    }
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isValidProjectStatus(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    if (isGovernedProjectStatus(body.status)) {
      return NextResponse.json(
        { error: "Governed transition requires dedicated POST endpoint", code: "GOVERNED_ACTION" },
        { status: 400 }
      );
    }
    if (!canTransitionProject(project.status as any, body.status)) {
      return NextResponse.json({ error: `Invalid transition ${project.status} → ${body.status}` }, { status: 400 });
    }
    data.status = body.status;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.project.update({ where: { id }, data });
    if (body.status !== undefined && body.status !== project.status) {
      await tx.stageHistory.create({
        data: {
          tenantId: ctx.tenantId,
          entityType: "project",
          entityId: id,
          fromStatus: project.status,
          toStatus: body.status,
          actorId: ctx.userId,
        },
      });
    }
    return u;
  });
  return NextResponse.json({ project: serialize(updated) });
}
