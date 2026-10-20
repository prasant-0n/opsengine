import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireOnboardingAuthz, isResponse } from "../../../_lib";

export const dynamic = "force-dynamic";

// Assign or clear the mentor/buddy for a plan.
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
  if (body.buddyEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: body.buddyEmployeeId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!emp) return NextResponse.json({ error: "Invalid buddyEmployeeId" }, { status: 400 });
  }

  const updated = await prisma.onboardingPlan.update({
    where: { id: plan.id },
    data: { buddyEmployeeId: body.buddyEmployeeId ?? null },
  });
  return NextResponse.json({ plan: updated });
}
