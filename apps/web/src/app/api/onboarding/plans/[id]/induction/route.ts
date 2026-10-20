import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_INDUCTION_MANAGE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const plan = await prisma.onboardingPlan.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!body.startAt || !body.endAt) return NextResponse.json({ error: "startAt and endAt are required" }, { status: 400 });
  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return NextResponse.json({ error: "Invalid startAt/endAt" }, { status: 400 });
  if (endAt.getTime() <= startAt.getTime()) return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  if (body.ownerEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: body.ownerEmployeeId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!emp) return NextResponse.json({ error: "Invalid ownerEmployeeId" }, { status: 400 });
  }

  const event = await prisma.inductionEvent.create({
    data: {
      tenantId: ctx.tenantId,
      planId: plan.id,
      title: body.title.trim(),
      startAt,
      endAt,
      timezone: typeof body.timezone === "string" && body.timezone ? body.timezone : "UTC",
      location: typeof body.location === "string" ? body.location : null,
      link: typeof body.link === "string" ? body.link : null,
      ownerEmployeeId: body.ownerEmployeeId ?? null,
    },
  });
  return NextResponse.json({ event }, { status: 201 });
}
