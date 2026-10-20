import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canWithdraw } from "@/features/approvals/lib/approvals";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_REQUEST, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const instance = await prisma.approvalInstance.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!canWithdraw(instance.status, instance.requesterEmployeeId, ctx.employeeId)) {
    if (instance.status !== "pending") return NextResponse.json({ error: `Instance is '${instance.status}'`, code: "NOT_PENDING" }, { status: 409 });
    return NextResponse.json({ error: "Only the requester may withdraw" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.approvalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        instanceId: id,
        approverEmployeeId: ctx.employeeId!,
        decision: "withdraw",
        reason: reason || null,
      },
    });
    const u = await tx.approvalInstance.update({ where: { id }, data: { status: "cancelled", decidedAt: new Date() } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "approval_instance",
        entityId: id,
        fromStatus: instance.status,
        toStatus: "cancelled",
        actorId: ctx.userId,
        reason: `Withdrawn${reason ? `: ${reason}` : ""}`,
      },
    });
    return u;
  });

  return NextResponse.json({ instance: { ...updated, amountCents: updated.amountCents !== null ? String(updated.amountCents) : null } });
}
