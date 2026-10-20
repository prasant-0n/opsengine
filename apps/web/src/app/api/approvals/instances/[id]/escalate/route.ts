import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canDecideInstance, type StepMode } from "@/features/approvals/lib/approvals";
import { resolveStepsForTenant } from "@/features/approvals/lib/resolution";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_DECIDE, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const instance = await prisma.approvalInstance.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (instance.status !== "pending") return NextResponse.json({ error: `Instance is '${instance.status}'`, code: "NOT_PENDING" }, { status: 409 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  const currentStep = await prisma.approvalStep.findFirst({
    where: { tenantId: ctx.tenantId, instanceId: id, stepNumber: instance.currentStepNumber },
  });
  if (!currentStep) return NextResponse.json({ error: "Current step not found" }, { status: 409 });

  // Only a resolved approver on the current step may escalate.
  const resolved = await resolveStepsForTenant(
    ctx.tenantId,
    instance.requesterEmployeeId,
    [{
      stepNumber: currentStep.stepNumber,
      name: currentStep.name,
      mode: currentStep.mode as StepMode,
      resolver: currentStep.resolver as any,
      minApprovals: currentStep.minApprovals,
    }],
    instance.subjectType,
    null,
    instance.amountCents !== null ? Number(instance.amountCents) : null,
  );
  if (!canDecideInstance(instance.status, currentStep.status, resolved[0]?.approverIds ?? [], ctx.employeeId)) {
    return NextResponse.json({ error: "Not an approver for the current step" }, { status: 403 });
  }

  // Escalation walks the requester's reporting tree one level above the current approver.
  const escalation = await resolveStepsForTenant(
    ctx.tenantId,
    instance.requesterEmployeeId,
    [{ stepNumber: 1, name: "escalation", mode: "any", resolver: { type: "REPORTING_TREE_OF_REQUESTER" }, minApprovals: 1 }],
    instance.subjectType,
    null,
    null,
  );
  const escalationTargets = (escalation[0]?.approverIds ?? []).filter((x) => x !== ctx.employeeId);

  await prisma.$transaction(async (tx) => {
    await tx.approvalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        instanceId: id,
        stepId: currentStep.id,
        approverEmployeeId: ctx.employeeId!,
        decision: "escalate",
        reason: reason || null,
      },
    });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "approval_instance",
        entityId: id,
        fromStatus: instance.status,
        toStatus: instance.status,
        actorId: ctx.userId,
        reason: `Escalated to ${escalationTargets.length} approver(s)${reason ? `: ${reason}` : ""}`,
      },
    });
  });

  return NextResponse.json({
    instance: { ...instance, amountCents: instance.amountCents !== null ? String(instance.amountCents) : null },
    escalatedTo: escalationTargets,
  });
}
