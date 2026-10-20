import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOnboardingAuthz(PERMISSIONS.ONBOARDING_PLAN_UPDATE);
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
  if (!body.policyName || typeof body.policyName !== "string" || !body.policyName.trim()) return NextResponse.json({ error: "policyName is required" }, { status: 400 });
  if (!body.policyVersion || typeof body.policyVersion !== "string" || !body.policyVersion.trim()) return NextResponse.json({ error: "policyVersion is required" }, { status: 400 });

  const ack = await prisma.policyAcknowledgement.create({
    data: {
      tenantId: ctx.tenantId,
      planId: plan.id,
      policyName: body.policyName.trim(),
      policyVersion: body.policyVersion.trim(),
      acknowledgedAt: new Date(),
      ackRef: typeof body.ackRef === "string" ? body.ackRef : null,
    },
  });
  return NextResponse.json({ acknowledgement: ack }, { status: 201 });
}
