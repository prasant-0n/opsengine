import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import type { WorkflowRules } from "@/features/approvals/lib/approvals";
import { resolveStepsForTenant, findPublishedWorkflow } from "@/features/approvals/lib/resolution";
import { createNotification } from "@/features/notifications/lib/notifications";

export const dynamic = "force-dynamic";

// Integration point (PRD §4: cross-team / extended resource allocation requires approval).
// The allocation's declarative cost is supplied as validated data (`costCents`); the
// tenant's `allocation` workflow decides the actual threshold. Below-threshold requests
// are rejected so the direct (non-approval) allocation path remains the fast lane.
export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_REQUEST, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const allocationId = typeof body.allocationId === "string" ? body.allocationId.trim() : "";
  if (!allocationId) return NextResponse.json({ error: "allocationId is required" }, { status: 400 });

  const allocation = await prisma.allocation.findFirst({ where: { id: allocationId, tenantId: ctx.tenantId } });
  if (!allocation) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });

  const costCents = body.costCents === undefined || body.costCents === null ? null : Number(body.costCents);
  if (costCents !== null && (!Number.isInteger(costCents) || costCents < 0)) {
    return NextResponse.json({ error: "costCents must be a non-negative integer" }, { status: 400 });
  }

  const published = await findPublishedWorkflow(ctx.tenantId, "allocation");
  if (!published) return NextResponse.json({ error: "No published allocation workflow", code: "NO_WORKFLOW" }, { status: 400 });

  const rules = published.version.rules as unknown as WorkflowRules;
  const thresholds = rules.steps
    .map((s) => s.amountThresholdCents)
    .filter((t): t is number => typeof t === "number");
  const minThreshold = thresholds.length ? Math.min(...thresholds) : null;
  if (minThreshold !== null && (costCents === null || costCents < minThreshold)) {
    return NextResponse.json(
      { error: "Allocation is below the configured approval threshold", code: "BELOW_THRESHOLD", thresholdCents: minThreshold },
      { status: 400 },
    );
  }

  const subjectVersion = allocation.updatedAt.toISOString();
  const resolved = await resolveStepsForTenant(
    ctx.tenantId,
    ctx.employeeId,
    rules.steps,
    "allocation",
    published.definition.id,
    costCents,
  );
  const activeSteps = resolved.filter((r) => !r.skipped);
  if (activeSteps.length === 0) {
    return NextResponse.json({ error: "No approver could be resolved for this request", code: "NO_APPROVER" }, { status: 400 });
  }

  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.create({
      data: {
        tenantId: ctx.tenantId,
        subjectType: "allocation",
        subjectId: allocation.id,
        subjectVersion,
        subjectContext: {
          projectId: allocation.projectId,
          employeeId: allocation.employeeId,
          percentage: allocation.percentage,
          costCents,
        } as any,
        workflowVersionId: published.version.id,
        requesterEmployeeId: ctx.employeeId!,
        status: "pending",
        currentStepNumber: activeSteps[0].rule.stepNumber,
        reason: typeof body.reason === "string" ? body.reason.trim() : null,
        amountCents: costCents !== null ? BigInt(costCents) : null,
      },
    });
    for (const r of resolved) {
      await tx.approvalStep.create({
        data: {
          tenantId: ctx.tenantId,
          instanceId: inst.id,
          stepNumber: r.rule.stepNumber,
          name: r.rule.name,
          mode: r.rule.mode,
          resolver: r.rule.resolver as any,
          minApprovals: r.rule.minApprovals,
          amountThresholdCents: r.rule.amountThresholdCents !== undefined ? BigInt(r.rule.amountThresholdCents) : null,
          status: r.skipped ? "skipped" : "pending",
        },
      });
    }
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "approval_instance",
        entityId: inst.id,
        toStatus: "pending",
        actorId: ctx.userId,
        reason: `Raised allocation approval for ${allocation.id}`,
      },
    });
    return inst;
  });

  const adminUsers = await prisma.authUser.findMany({ where: { tenantId: ctx.tenantId }, select: { id: true } });
  for (const u of adminUsers) {
    await createNotification({
      tenantId: ctx.tenantId,
      recipientUserId: u.id,
      category: "approval",
      title: "New Approval Request",
      body: `An allocation approval request was raised.`,
      metadata: { instanceId: instance.id },
    });
  }

  return NextResponse.json(
    { instance: { ...instance, amountCents: instance.amountCents !== null ? String(instance.amountCents) : null } },
    { status: 201 },
  );
}
