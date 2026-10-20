import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

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
  const authz = authorize(ctx, PERMISSIONS.RECRUIT_INTERVIEW_FEEDBACK, { tenantId: ctx.tenantId, resourceType: "interview", id });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const rating = parseInt(body.rating);
  if (!body.interviewerId || isNaN(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Invalid rating/interviewerId" }, { status: 400 });
  const empOk = await prisma.employee.findFirst({ where: { id: String(body.interviewerId), tenantId: ctx.tenantId }, select: { id: true } });
  if (!empOk) return NextResponse.json({ error: "Invalid interviewerId" }, { status: 400 });
  const fb = await prisma.interviewFeedback.create({
    data: { tenantId: ctx.tenantId, interviewId: id, interviewerId: body.interviewerId, rating, notes: body.notes ?? null },
  });
  return NextResponse.json({ feedback: fb }, { status: 201 });
}
