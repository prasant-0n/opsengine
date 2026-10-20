import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, writeAudit } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionRequisition } from "@/features/recruitment/lib/recruitment";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

async function load() {
  const token = await getSessionToken();
  if (!token) return null;
  return buildAuthContext(token);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await load();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const row = await prisma.requisition.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_REQUISITION_APPROVE, { tenantId: ctx.tenantId, resourceType: "requisition", id }, { audit: true });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? ""); // approve|reject
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve|reject" }, { status: 400 });
  }
  const to = action === "reject" ? "rejected" : "approved";
  if (!canTransitionRequisition(row.status as any, to as any)) return NextResponse.json({ error: "Invalid transition" }, { status: 400 });
  const updated = await prisma.requisition.update({ where: { id }, data: { status: to, approvedBy: ctx.userId, approvedAt: new Date() } });
  await prisma.stageHistory.create({
    data: { tenantId: ctx.tenantId, entityType: "requisition", entityId: id, fromStatus: row.status, toStatus: to, actorId: ctx.userId, reason: action },
  });
  writeAudit({ tenantId: ctx.tenantId, actorUserId: ctx.userId, eventType: "recruit.requisition.approve", resourceType: "requisition", resourceId: id, decision: "allow", reasonCode: "REQ_APPROVE" });
  return NextResponse.json({ requisition: updated });
}
