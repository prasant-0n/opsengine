import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  canDecideInstance,
  isSelfApproval,
  nextStateAfterDecision,
  type DecisionType,
  type StepMode,
} from "@/features/approvals/lib/approvals";
import { resolveStepsForTenant } from "@/features/approvals/lib/resolution";
import { createNotification } from "@/features/notifications/lib/notifications";

export const dynamic = "force-dynamic";

const DECISIONS: DecisionType[] = ["approve", "reject", "request_changes"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const decision = (typeof body.decision === "string" ? body.decision : "") as DecisionType;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "decision must be approve|reject|request_changes" }, { status: 400 });
  }
  if (decision !== "approve" && !reason) {
    return NextResponse.json({ error: "reason is required for reject/request_changes" }, { status: 400 });
  }

  const instance = await prisma.approvalInstance.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (instance.status !== "pending") {
    return NextResponse.json({ error: `Instance is '${instance.status}', not pending`, code: "NOT_PENDING" }, { status: 409 });
  }

  // Approval is bound to the exact reviewed revision.
  if (typeof body.subjectVersion === "string" && body.subjectVersion !== instance.subjectVersion) {
    return NextResponse.json({ error: "Subject has changed since the request was raised", code: "STALE_SUBJECT" }, { status: 409 });
  }

  const currentStep = await prisma.approvalStep.findFirst({
    where: { tenantId: ctx.tenantId, instanceId: id, stepNumber: instance.currentStepNumber },
  });
  if (!currentStep) return NextResponse.json({ error: "Current step not found" }, { status: 409 });
  if (currentStep.status !== "pending") return NextResponse.json({ error: "Current step is not pending" }, { status: 409 });

  // Re-resolve approvers server-side: holding approval.decide is not sufficient.
  const resolved = await resolveStepsForTenant(
    ctx.tenantId,
    instance.requesterEmployeeId,
    [{
      stepNumber: currentStep.stepNumber,
      name: currentStep.name,
      mode: currentStep.mode as StepMode,
      resolver: currentStep.resolver as any,
      minApprovals: currentStep.minApprovals,
      ...(currentStep.amountThresholdCents !== null ? { amountThresholdCents: Number(currentStep.amountThresholdCents) } : {}),
    }],
    instance.subjectType,
    null,
    instance.amountCents !== null ? Number(instance.amountCents) : null,
  );
  const approverIds = resolved[0]?.approverIds ?? [];

  if (!canDecideInstance(instance.status, currentStep.status, approverIds, ctx.employeeId)) {
    return NextResponse.json({ error: "Not an approver for the current step" }, { status: 403 });
  }

  // Separation of duties: requester cannot approve their own request without override.
  const isSod = isSelfApproval(instance.requesterEmployeeId, ctx.employeeId);
  const hasOverride = ctx.permissions.some((p) => p.key === PERMISSIONS.APPROVAL_SOD_OVERRIDE);
  if (isSod && !hasOverride) {
    return NextResponse.json({ error: "Requester cannot decide their own request", code: "SOD_SELF_APPROVAL" }, { status: 403 });
  }

  const priorApprovals = await prisma.approvalDecision.count({
    where: { tenantId: ctx.tenantId, instanceId: id, stepId: currentStep.id, decision: "approve" },
  });
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.approvalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        instanceId: id,
        stepId: currentStep.id,
        approverEmployeeId: ctx.employeeId!,
        decision,
        reason: reason || null,
        isSodOverride: isSod && hasOverride,
        decidedAt: now,
      },
    });

    const remainingSteps = await tx.approvalStep.count({
      where: { tenantId: ctx.tenantId, instanceId: id, stepNumber: { gt: currentStep.stepNumber }, status: { not: "skipped" } },
    });

    const next = nextStateAfterDecision(
      decision,
      currentStep.mode as StepMode,
      priorApprovals + (decision === "approve" ? 1 : 0),
      currentStep.minApprovals,
      remainingSteps > 0,
    );

    await tx.approvalStep.update({ where: { id: currentStep.id }, data: { status: next.stepStatus } });

    let nextStepNumber = instance.currentStepNumber;
    if (next.advance) {
      const nextStep = await tx.approvalStep.findFirst({
        where: { tenantId: ctx.tenantId, instanceId: id, status: "pending" },
        orderBy: { stepNumber: "asc" },
      });
      if (nextStep) nextStepNumber = nextStep.stepNumber;
    }

    const updated = await tx.approvalInstance.update({
      where: { id },
      data: {
        status: next.instanceStatus ?? "pending",
        currentStepNumber: nextStepNumber,
        ...(next.instanceStatus && next.instanceStatus !== "pending" ? { decidedAt: now } : {}),
      },
    });

    const fromStatus = instance.status;
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "approval_instance",
        entityId: id,
        fromStatus,
        toStatus: updated.status,
        actorId: ctx.userId,
        reason: `${decision}${reason ? `: ${reason}` : ""}${isSod && hasOverride ? " [SOD OVERRIDE]" : ""}`,
      },
    });
    return updated;
  });

  if (instance.requesterEmployeeId) {
    const reqEmp = await prisma.employee.findFirst({ where: { id: instance.requesterEmployeeId, tenantId: ctx.tenantId }, select: { userId: true } });
    if (reqEmp && reqEmp.userId) {
      await createNotification({
        tenantId: ctx.tenantId,
        recipientUserId: reqEmp.userId,
        category: "approval",
        title: `Approval Request ${decision.toUpperCase()}`,
        body: `Your approval request (${instance.subjectType}) was ${decision}.${reason ? ` Reason: ${reason}` : ""}`,
        metadata: { instanceId: id },
      });
    }
  }

  return NextResponse.json({
    instance: { ...result, amountCents: result.amountCents !== null ? String(result.amountCents) : null },
  });
}
