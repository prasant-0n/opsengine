import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionCandidate, CANDIDATE_STATUSES } from "@/features/recruitment/lib/recruitment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_CANDIDATE_READ, { tenantId: ctx.tenantId, resourceType: "candidate" });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const where: any = { tenantId: ctx.tenantId };
  const rows = await prisma.candidate.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  const reqIds = Array.from(new Set(rows.map((r) => r.linkedRequisitionId).filter(Boolean))) as string[];
  const reqs = reqIds.length
    ? await prisma.requisition.findMany({ where: { id: { in: reqIds }, tenantId: ctx.tenantId }, select: { id: true, jobTitle: true } })
    : [];
  const reqTitle = new Map(reqs.map((r) => [r.id, r.jobTitle]));
  const enriched = rows.map((r) => ({ ...r, requisitionTitle: r.linkedRequisitionId ? (reqTitle.get(r.linkedRequisitionId) ?? null) : null }));
  return NextResponse.json({ candidates: enriched });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_CANDIDATE_CREATE, { tenantId: ctx.tenantId, resourceType: "candidate" });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body.fullName || !body.email) return NextResponse.json({ error: "Missing fullName/email" }, { status: 400 });
  if (body.linkedRequisitionId) {
    const reqOk = await prisma.requisition.findFirst({ where: { id: body.linkedRequisitionId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!reqOk) return NextResponse.json({ error: "Invalid linkedRequisitionId" }, { status: 400 });
  }
  const cand = await prisma.candidate.create({
    data: {
      tenantId: ctx.tenantId,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      source: body.source ?? null,
      resumeUrl: body.resumeUrl ?? null,
      consentGiven: Boolean(body.consentGiven),
      consentAt: body.consentGiven ? new Date() : null,
      linkedRequisitionId: body.linkedRequisitionId ?? null,
      notes: body.notes ?? null,
      status: "applied",
    },
  });
  await prisma.stageHistory.create({
    data: { tenantId: ctx.tenantId, entityType: "candidate", entityId: cand.id, toStatus: "applied", actorId: ctx.userId, reason: "created" },
  });
  return NextResponse.json({ candidate: cand }, { status: 201 });
}
