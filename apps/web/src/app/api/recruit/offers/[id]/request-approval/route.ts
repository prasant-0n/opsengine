import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { authorize } from "@/lib/permissions";
import { requireOfferAuthz, isResponse, serializeOffer } from "../../../_lib";
import { isOfferEditable } from "@/features/recruitment/lib/offers";
import type { WorkflowRules } from "@/features/approvals/lib/approvals";
import { resolveStepsForTenant, findPublishedWorkflow } from "@/features/approvals/lib/resolution";

export const dynamic = "force-dynamic";

// Offer approval integration: raise an instance with subjectType "offer" via the
// Module 13 engine (ADR-0013). Sending requires the instance to be approved first.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfferAuthz(PERMISSIONS.RECRUIT_OFFER_CREATE);
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const offer = await prisma.offer.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isOfferEditable(offer)) return NextResponse.json({ error: "Approval can only be requested on a draft offer" }, { status: 409 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const approveOk = authorize(ctx, PERMISSIONS.APPROVAL_REQUEST, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  }).allowed;
  if (!approveOk) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const published = await findPublishedWorkflow(ctx.tenantId, "offer");
  if (!published) return NextResponse.json({ error: "No published offer workflow", code: "NO_WORKFLOW" }, { status: 400 });

  const rules = published.version.rules as unknown as WorkflowRules;
  const subjectVersion = offer.updatedAt.toISOString();
  const resolved = await resolveStepsForTenant(
    ctx.tenantId,
    ctx.employeeId,
    rules.steps,
    "offer",
    published.definition.id,
    Number(offer.baseCompCents),
  );
  const activeSteps = resolved.filter((r) => !r.skipped);
  if (activeSteps.length === 0) return NextResponse.json({ error: "No approver could be resolved for this request", code: "NO_APPROVER" }, { status: 400 });

  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.create({
      data: {
        tenantId: ctx.tenantId,
        subjectType: "offer",
        subjectId: offer.id,
        subjectVersion,
        subjectContext: { offerNumber: offer.number, candidateId: offer.candidateId, baseCompCents: offer.baseCompCents.toString(), currency: offer.currency } as any,
        workflowVersionId: published.version.id,
        requesterEmployeeId: ctx.employeeId!,
        status: "pending",
        currentStepNumber: activeSteps[0].rule.stepNumber,
        reason: typeof body.reason === "string" ? body.reason.trim() : null,
        amountCents: offer.baseCompCents,
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
        entityType: "offer",
        entityId: offer.id,
        fromStatus: "draft",
        toStatus: "pending_approval",
        actorId: ctx.userId,
        reason: `Raised approval for offer ${offer.number}`,
      },
    });
    const updated = await tx.offer.update({ where: { id: offer.id }, data: { status: "pending_approval", approvalInstanceId: inst.id } });
    return { inst, updated };
  });

  return NextResponse.json(
    {
      offer: serializeOffer(instance.updated),
      instance: { ...instance.inst, amountCents: instance.inst.amountCents !== null ? String(instance.inst.amountCents) : null },
    },
    { status: 201 },
  );
}
