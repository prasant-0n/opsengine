import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializePayment, serializeReceivable, serializeInvoice } from "../../../_lib";
import { isKnownPaymentMethod, isValidAmountCents, deriveReceivable } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

async function recompute(tenantId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) return null;
  const receivable = await prisma.receivable.findFirst({ where: { tenantId, invoiceId } });
  if (!receivable) return null;
  const payments = await prisma.payment.findMany({ where: { tenantId, invoiceId } });
  const adjustments = await prisma.paymentAdjustment.findMany({ where: { tenantId, invoiceId } });
  const disputeStatus = invoice.disputeStatus === "raised" ? "raised" : "none";
  const derived = deriveReceivable({
    originalAmountCents: Number(receivable.originalAmountCents),
    payments: payments.map((p) => ({ amountCents: Number(p.amountCents) })),
    adjustments: adjustments.map((a) => ({ type: a.type as any, amountCents: Number(a.amountCents) })),
    disputeStatus: disputeStatus as any,
  });
  const updatedReceivable = await prisma.receivable.update({
    where: { id: receivable.id },
    data: {
      paidAmountCents: BigInt(derived.paidAmountCents),
      outstandingCents: BigInt(derived.outstandingCents),
      status: derived.status,
    },
  });
  // Reflect payment progress on the invoice status without overriding dispute/void.
  if (invoice.status !== "void") {
    const invStatus = derived.outstandingCents === 0 ? "paid" : derived.paidAmountCents > 0 ? "partially_paid" : "issued";
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: invStatus } });
  }
  return { receivable: updatedReceivable, derived };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_RECEIVABLE_READ, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payments = await prisma.payment.findMany({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id }, orderBy: { receivedOn: "desc" } });
  return NextResponse.json({ payments: payments.map(serializePayment) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_RECEIVABLE_RECORD_PAYMENT, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status === "draft") return NextResponse.json({ error: "Cannot record a payment against a draft invoice" }, { status: 409 });
  if (invoice.status === "void") return NextResponse.json({ error: "Cannot record a payment against a void invoice" }, { status: 409 });

  const receivable = await prisma.receivable.findFirst({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id } });
  if (!receivable) return NextResponse.json({ error: "No receivable for this invoice" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidAmountCents(body.amountCents) || body.amountCents === 0) return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
  const method = body.method ?? "bank_transfer";
  if (!isKnownPaymentMethod(method)) return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  const receivedOn = body.receivedOn ? new Date(body.receivedOn) : new Date();
  if (isNaN(receivedOn.getTime())) return NextResponse.json({ error: "Invalid receivedOn" }, { status: 400 });

  if (BigInt(body.amountCents) > receivable.outstandingCents) {
    return NextResponse.json({ error: "Payment exceeds the outstanding balance", code: "OVERPAYMENT" }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      receivableId: receivable.id,
      amountCents: BigInt(body.amountCents),
      currency: invoice.currency,
      receivedOn,
      method,
      reference: typeof body.reference === "string" ? body.reference : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      recordedBy: ctx.userId,
    },
  });
  const result = await recompute(ctx.tenantId, invoice.id);
  const freshInvoice = await prisma.invoice.findFirst({ where: { id: invoice.id, tenantId: ctx.tenantId } });
  return NextResponse.json(
    {
      payment: serializePayment(payment),
      receivable: serializeReceivable(result?.receivable),
      invoice: serializeInvoice(freshInvoice),
    },
    { status: 201 },
  );
}
