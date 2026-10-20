import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { authorize } from "@/lib/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice } from "../../../_lib";
import { termsExceedThreshold } from "@/features/finance/lib/finance";
import type { WorkflowRules } from "@/features/approvals/lib/approvals";
import { resolveStepsForTenant, findPublishedWorkflow } from "@/features/approvals/lib/resolution";

export const dynamic = "force-dynamic";

// Commercial-exception integration: payment terms beyond the tenant default raise an
// approval instance with subjectType "invoice" through the Module 13 engine (ADR-0012).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_CREATE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status !== "draft") return NextResponse.json({ error: "Terms can only be requested on a draft invoice" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const paymentTermsDays = Number(body.paymentTermsDays);
  if (!termsExceedThreshold(paymentTermsDays)) {
    return NextResponse.json({ error: "Payment terms are within the standard threshold", code: "BELOW_THRESHOLD" }, { status: 400 });
  }

  const approveOk = authorize(ctx, PERMISSIONS.APPROVAL_REQUEST, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  }).allowed;
  if (!approveOk) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const published = await findPublishedWorkflow(ctx.tenantId, "invoice");
  if (!published) return NextResponse.json({ error: "No published invoice workflow", code: "NO_WORKFLOW" }, { status: 400 });

  const rules = published.version.rules as unknown as WorkflowRules;
  const subjectVersion = invoice.updatedAt.toISOString();
  const resolved = await resolveStepsForTenant(ctx.tenantId, ctx.employeeId, rules.steps, "invoice", published.definition.id, Number(invoice.totalCents));
  const activeSteps = resolved.filter((r) => !r.skipped);
  if (activeSteps.length === 0) return NextResponse.json({ error: "No approver could be resolved for this request", code: "NO_APPROVER" }, { status: 400 });

  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.create({
      data: {
        tenantId: ctx.tenantId,
        subjectType: "invoice",
        subjectId: invoice.id,
        subjectVersion,
        subjectContext: { invoiceNumber: invoice.number, accountId: invoice.accountId, paymentTermsDays, totalCents: invoice.totalCents.toString() } as any,
        workflowVersionId: published.version.id,
        requesterEmployeeId: ctx.employeeId!,
        status: "pending",
        currentStepNumber: activeSteps[0].rule.stepNumber,
        reason: typeof body.reason === "string" ? body.reason.trim() : null,
        amountCents: invoice.totalCents,
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
        reason: `Raised terms exception for invoice ${invoice.number}`,
      },
    });
    const updated = await tx.invoice.update({ where: { id: invoice.id }, data: { paymentTermsDays, approvalInstanceId: inst.id } });
    return { inst, updated };
  });

  return NextResponse.json(
    {
      invoice: serializeInvoice(instance.updated),
      instance: { ...instance.inst, amountCents: instance.inst.amountCents !== null ? String(instance.inst.amountCents) : null },
    },
    { status: 201 },
  );
}
