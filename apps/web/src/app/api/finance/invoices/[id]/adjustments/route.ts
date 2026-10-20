import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { authorize } from "@/lib/permissions";
import { requireFinanceAuthz, isResponse, serializeAdjustment, serializeReceivable } from "../../../_lib";
import { isKnownAdjustmentType, isValidSignedCents, WRITE_OFF_APPROVAL_THRESHOLD_CENTS } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

async function recompute(tenantId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) return null;
  const receivable = await prisma.receivable.findFirst({ where: { tenantId, invoiceId } });
  if (!receivable) return null;
  const payments = await prisma.payment.findMany({ where: { tenantId, invoiceId } });
  const adjustments = await prisma.paymentAdjustment.findMany({ where: { tenantId, invoiceId } });
  const { deriveReceivable } = await import("@/features/finance/lib/finance");
  const derived = deriveReceivable({
    originalAmountCents: Number(receivable.originalAmountCents),
    payments: payments.map((p) => ({ amountCents: Number(p.amountCents) })),
    adjustments: adjustments.map((a) => ({ type: a.type as any, amountCents: Number(a.amountCents) })),
    disputeStatus: (invoice.disputeStatus === "raised" ? "raised" : "none") as any,
  });
  const updatedReceivable = await prisma.receivable.update({
    where: { id: receivable.id },
    data: { paidAmountCents: BigInt(derived.paidAmountCents), outstandingCents: BigInt(derived.outstandingCents), status: derived.status },
  });
  return updatedReceivable;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_RECEIVABLE_READ, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const adjustments = await prisma.paymentAdjustment.findMany({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ adjustments: adjustments.map(serializeAdjustment) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_RECEIVABLE_ADJUST, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status === "draft") return NextResponse.json({ error: "Cannot adjust a draft invoice" }, { status: 409 });

  const receivable = await prisma.receivable.findFirst({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id } });
  if (!receivable) return NextResponse.json({ error: "No receivable for this invoice" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isKnownAdjustmentType(body.type)) return NextResponse.json({ error: "Invalid adjustment type" }, { status: 400 });
  if (!isValidSignedCents(body.amountCents) || body.amountCents === 0) return NextResponse.json({ error: "amountCents must be a non-zero integer" }, { status: 400 });
  if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  // Write-offs at/above the threshold require an approved commercial-exception OR the approve permission.
  if (body.type === "write_off" && Math.abs(body.amountCents) >= WRITE_OFF_APPROVAL_THRESHOLD_CENTS) {
    const approveOk = authorize(ctx, PERMISSIONS.FINANCE_COMMERCIAL_TERMS_APPROVE, { tenantId: ctx.tenantId, resourceType: "invoice" }).allowed;
    if (!approveOk) {
      return NextResponse.json(
        { error: "Write-off above threshold requires commercial-terms approval", code: "WRITE_OFF_REQUIRES_APPROVAL" },
        { status: 403 },
      );
    }
  }

  const adjustment = await prisma.paymentAdjustment.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      paymentId: body.paymentId ?? null,
      type: body.type,
      amountCents: BigInt(body.amountCents),
      reason: body.reason,
      approvedBy: ctx.userId,
      createdBy: ctx.userId,
    },
  });
  const updatedReceivable = await recompute(ctx.tenantId, invoice.id);
  return NextResponse.json({ adjustment: serializeAdjustment(adjustment), receivable: serializeReceivable(updatedReceivable) }, { status: 201 });
}
