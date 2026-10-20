import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, writeAudit } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { INTERVIEW_STATUSES } from "@/features/recruitment/lib/recruitment";

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
  const row = await prisma.interview.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_INTERVIEW_DECIDE, { tenantId: ctx.tenantId, resourceType: "interview", id }, { audit: true });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const to = String(body.status ?? "completed");
  if (!(INTERVIEW_STATUSES as readonly string[]).includes(to)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const updated = await prisma.interview.update({ where: { id }, data: { status: to } });
  await prisma.stageHistory.create({
    data: { tenantId: ctx.tenantId, entityType: "interview", entityId: id, fromStatus: row.status, toStatus: to, actorId: ctx.userId, reason: body.reason ?? "outcome" },
  });
  writeAudit({ tenantId: ctx.tenantId, actorUserId: ctx.userId, eventType: "recruit.interview.decision", resourceType: "interview", resourceId: id, decision: "allow", reasonCode: "INTV_DECIDE" });
  return NextResponse.json({ interview: updated });
}
