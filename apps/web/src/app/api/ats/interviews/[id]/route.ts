import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
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

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await load();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const row = await prisma.interview.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) notFound();
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_INTERVIEW_READ, { tenantId: ctx.tenantId, resourceType: "interview", id });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const panel = await prisma.interviewPanelMember.findMany({ where: { tenantId: ctx.tenantId, interviewId: id } });
  const feedback = await prisma.interviewFeedback.findMany({ where: { tenantId: ctx.tenantId, interviewId: id } });
  const history = await prisma.stageHistory.findMany({
    where: { tenantId: ctx.tenantId, entityType: "interview", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ interview: row, panel, feedback, history });
}
