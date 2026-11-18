import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isKnownSubjectType, isInstanceOverdue, type WorkflowRules } from "@/features/approvals/lib/approvals";
import { resolveStepsForTenant, findPublishedWorkflow } from "@/features/approvals/lib/resolution";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const view = (searchParams.get("view") ?? "assigned").trim();
  const statusFilter = (searchParams.get("status") ?? "").trim();
  const subjectTypeFilter = (searchParams.get("subjectType") ?? "").trim();
  const overdueOnly = searchParams.get("overdue") === "1";

  const isAllView = view === "all";
  const authz = authorize(ctx, PERMISSIONS.APPROVAL_READ, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    ...(isAllView ? {} : { owningEmployeeId: ctx.employeeId }),
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const baseWhere: any = { tenantId: ctx.tenantId };
  if (statusFilter) baseWhere.status = statusFilter;
  if (subjectTypeFilter) baseWhere.subjectType = subjectTypeFilter;

  let instances;
  if (view === "requested") {
    instances = await prisma.approvalInstance.findMany({
      where: { ...baseWhere, requesterEmployeeId: ctx.employeeId },
      orderBy: { createdAt: "desc" },
    });
  } else if (view === "all") {
    instances = await prisma.approvalInstance.findMany({ where: baseWhere, orderBy: { createdAt: "desc" } });
  } else {
    // assigned: pending instances where the actor is a resolved approver on the current step.
    const pending = await prisma.approvalInstance.findMany({
      where: { ...baseWhere, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    const currentSteps = await prisma.approvalStep.findMany({
      where: {
        tenantId: ctx.tenantId,
        instanceId: { in: pending.map((p) => p.id) },
      },
    });
    const hired = await Promise.all(
      pending.map(async (inst) => {
        const step = currentSteps.find((s) => s.instanceId === inst.id && s.stepNumber === inst.currentStepNumber);
        if (!step) return null;
        const resolved = await resolveStepsForTenant(
          ctx.tenantId,
          inst.requesterEmployeeId,
          [stepToRule(step)],
          inst.subjectType,
          null,
          inst.amountCents !== null ? Number(inst.amountCents) : null,
        );
        return resolved[0]?.approverIds.includes(ctx.employeeId!) ? inst : null;
      }),
    );
    instances = hired.filter((x): x is NonNullable<typeof x> => x !== null);
  }

  const now = new Date();
  const enriched = instances
    .map((i) => ({
      ...i,
      amountCents: i.amountCents !== null ? String(i.amountCents) : null,
      overdue: isInstanceOverdue(i.dueAt, i.status, now),
    }))
    .filter((i) => !overdueOnly || i.overdue);
  return NextResponse.json({ instances: enriched });
}

function stepToRule(step: { stepNumber: number; name: string; mode: string; resolver: unknown; minApprovals: number; amountThresholdCents: bigint | null }) {
  return {
    stepNumber: step.stepNumber,
    name: step.name,
    mode: step.mode as any,
    resolver: step.resolver as any,
    minApprovals: step.minApprovals,
    ...(step.amountThresholdCents !== null ? { amountThresholdCents: Number(step.amountThresholdCents) } : {}),
  };
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_REQUEST, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const subjectType = typeof body.subjectType === "string" ? body.subjectType.trim() : "";
  const subjectId = typeof body.subjectId === "string" ? body.subjectId.trim() : "";
  const subjectVersion = typeof body.subjectVersion === "string" ? body.subjectVersion.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;
  if (!isKnownSubjectType(subjectType)) return NextResponse.json({ error: "Unknown subjectType" }, { status: 400 });
  if (!subjectId) return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
  if (!subjectVersion) return NextResponse.json({ error: "subjectVersion is required" }, { status: 400 });

  const amountCents = body.amountCents === undefined || body.amountCents === null ? null : Number(body.amountCents);
  if (amountCents !== null && (!Number.isInteger(amountCents) || amountCents < 0)) {
    return NextResponse.json({ error: "amountCents must be a non-negative integer" }, { status: 400 });
  }

  const published = await findPublishedWorkflow(ctx.tenantId, subjectType);
  if (!published) return NextResponse.json({ error: `No published workflow for subject '${subjectType}'`, code: "NO_WORKFLOW" }, { status: 400 });

  const rules = published.version.rules as unknown as WorkflowRules;
  const resolved = await resolveStepsForTenant(
    ctx.tenantId,
    ctx.employeeId,
    rules.steps,
    subjectType,
    published.definition.id,
    amountCents,
  );

  const activeSteps = resolved.filter((r) => !r.skipped);
  if (activeSteps.length === 0) {
    // No step applies (all below threshold or no resolvable approver): auto-approve
    // is NOT performed — a human must still be routed. Fail safe.
    return NextResponse.json({ error: "No approver could be resolved for this request", code: "NO_APPROVER" }, { status: 400 });
  }

  const slaHours = Number(body.slaHours);
  const dueAt = Number.isFinite(slaHours) && slaHours > 0 ? new Date(Date.now() + slaHours * 3600_000) : null;

  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.create({
      data: {
        tenantId: ctx.tenantId,
        subjectType,
        subjectId,
        subjectVersion,
        subjectContext: (body.subjectContext ?? undefined) as any,
        workflowVersionId: published.version.id,
        requesterEmployeeId: ctx.employeeId!,
        status: "pending",
        currentStepNumber: activeSteps[0].rule.stepNumber,
        reason,
        amountCents: amountCents !== null ? BigInt(amountCents) : null,
        dueAt,
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
        reason: `Raised approval for ${subjectType} ${subjectId}`,
      },
    });
    return inst;
  });

  return NextResponse.json(
    { instance: { ...instance, amountCents: instance.amountCents !== null ? String(instance.amountCents) : null } },
    { status: 201 },
  );
}
