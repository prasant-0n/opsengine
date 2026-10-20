import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionCandidate, CANDIDATE_STATUSES } from "@/features/recruitment/lib/recruitment";

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
  const row = await prisma.candidate.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_CANDIDATE_READ, { tenantId: ctx.tenantId, resourceType: "candidate", id });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const history = await prisma.stageHistory.findMany({
    where: { tenantId: ctx.tenantId, entityType: "candidate", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ candidate: row, history });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await load();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const row = await prisma.candidate.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_CANDIDATE_UPDATE, { tenantId: ctx.tenantId, resourceType: "candidate", id });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.status != null) {
    const to = String(body.status);
    if (!(CANDIDATE_STATUSES as readonly string[]).includes(to)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    if (!canTransitionCandidate(row.status as any, to as any)) return NextResponse.json({ error: "Invalid transition" }, { status: 400 });
    data.status = to;
  }
  if (body.notes != null) data.notes = String(body.notes);
  if (body.phone != null) data.phone = String(body.phone);
  if (body.linkedRequisitionId != null) {
    const reqOk = await prisma.requisition.findFirst({ where: { id: String(body.linkedRequisitionId), tenantId: ctx.tenantId }, select: { id: true } });
    if (!reqOk) return NextResponse.json({ error: "Invalid linkedRequisitionId" }, { status: 400 });
    data.linkedRequisitionId = String(body.linkedRequisitionId);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  const updated = await prisma.candidate.update({ where: { id }, data });
  if (data.status && data.status !== row.status) {
    await prisma.stageHistory.create({
      data: { tenantId: ctx.tenantId, entityType: "candidate", entityId: id, fromStatus: row.status, toStatus: data.status, actorId: ctx.userId, reason: body.reason ?? "update" },
    });
  }
  return NextResponse.json({ candidate: updated });
}
