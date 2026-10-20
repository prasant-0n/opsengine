import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionRequisition, REQUISITION_STATUSES } from "@/features/recruitment/lib/recruitment";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

async function load() {
  const token = await getSessionToken();
  if (!token) return null;
  return buildAuthContext(token);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await load();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const row = await prisma.requisition.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_REQUISITION_READ, { tenantId: ctx.tenantId, resourceType: "requisition", id });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const history = await prisma.stageHistory.findMany({
    where: { tenantId: ctx.tenantId, entityType: "requisition", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ requisition: row, history });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await load();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const row = await prisma.requisition.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_REQUISITION_UPDATE, { tenantId: ctx.tenantId, resourceType: "requisition", id });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const data: any = {};
  if (body.jobTitle != null) data.jobTitle = String(body.jobTitle);
  if (body.jobFamily != null) data.jobFamily = String(body.jobFamily);
  if (body.grade != null) data.grade = String(body.grade);
  if (body.headcount != null) data.headcount = parseInt(body.headcount) || 1;
  if (body.budgetBand != null) data.budgetBand = String(body.budgetBand);
  if (body.hiringManagerId != null) {
    const empOk = await prisma.employee.findFirst({ where: { id: String(body.hiringManagerId), tenantId: ctx.tenantId }, select: { id: true } });
    if (!empOk) return NextResponse.json({ error: "Invalid hiringManagerId" }, { status: 400 });
    data.hiringManagerId = String(body.hiringManagerId);
  }
  if (body.justification != null) data.justification = String(body.justification);
  if (body.expectedStartDate != null) data.expectedStartDate = new Date(body.expectedStartDate);
  if (body.status != null) {
    const to = String(body.status);
    if (!(REQUISITION_STATUSES as readonly string[]).includes(to)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    // approve/reject is governed: actor + audit written only by POST /approve
    if (to === "approved" || to === "rejected") {
      return NextResponse.json({ error: "Use POST /approve for governed decisions", code: "GOVERNED_ACTION" }, { status: 400 });
    }
    if (!canTransitionRequisition(row.status as any, to as any)) return NextResponse.json({ error: "Invalid transition" }, { status: 400 });
    data.status = to;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  const updated = await prisma.requisition.update({ where: { id }, data });
  if (data.status && data.status !== row.status) {
    await prisma.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "requisition",
        entityId: id,
        fromStatus: row.status,
        toStatus: data.status,
        actorId: ctx.userId,
      },
    });
  }
  return NextResponse.json({ requisition: updated });
}
