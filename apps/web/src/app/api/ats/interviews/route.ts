import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_INTERVIEW_READ, { tenantId: ctx.tenantId, resourceType: "interview" });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await prisma.interview.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { startAt: "desc" }, take: 100 });
  const candIds = Array.from(new Set(rows.map((r) => r.candidateId).filter(Boolean))) as string[];
  const cands = candIds.length
    ? await prisma.candidate.findMany({ where: { id: { in: candIds }, tenantId: ctx.tenantId }, select: { id: true, fullName: true } })
    : [];
  const candName = new Map(cands.map((c) => [c.id, c.fullName]));
  const enriched = rows.map((r) => ({ ...r, candidateName: r.candidateId ? (candName.get(r.candidateId) ?? null) : null }));
  return NextResponse.json({ interviews: enriched });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_INTERVIEW_CREATE, { tenantId: ctx.tenantId, resourceType: "interview" });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body.startAt || !body.endAt || !body.candidateId) return NextResponse.json({ error: "Missing startAt/endAt/candidateId" }, { status: 400 });
  const candidateOk = await prisma.candidate.findFirst({ where: { id: body.candidateId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!candidateOk) return NextResponse.json({ error: "Invalid candidateId" }, { status: 400 });
  if (body.requisitionId) {
    const reqOk = await prisma.requisition.findFirst({ where: { id: body.requisitionId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!reqOk) return NextResponse.json({ error: "Invalid requisitionId" }, { status: 400 });
  }
  const start = new Date(body.startAt);
  const end = new Date(body.endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  const iv = await prisma.interview.create({
    data: {
      tenantId: ctx.tenantId,
      requisitionId: body.requisitionId ?? null,
      candidateId: body.candidateId,
      type: body.type ?? "phone",
      startAt: start,
      endAt: end,
      timezone: body.timezone ?? "UTC",
      location: body.location ?? null,
      meetingLink: body.meetingLink ?? null,
      status: "scheduled",
      createdBy: ctx.userId,
    },
  });
  await prisma.stageHistory.create({
    data: { tenantId: ctx.tenantId, entityType: "interview", entityId: iv.id, toStatus: "scheduled", actorId: ctx.userId, reason: "created" },
  });
  return NextResponse.json({ interview: iv }, { status: 201 });
}
