import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice, serializeLine, serializeReceivable, serializePayment, serializeAdjustment } from "../../_lib";
import { isDraftEditable, DEFAULT_TERMS_DAYS } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

async function loadInvoice(tenantId: string, id: string) {
  return prisma.invoice.findFirst({ where: { id, tenantId } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_READ, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await loadInvoice(ctx.tenantId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [lines, receivable, payments, adjustments] = await Promise.all([
    prisma.invoiceLine.findMany({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id }, orderBy: { lineNumber: "asc" } }),
    prisma.receivable.findFirst({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id } }),
    prisma.payment.findMany({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id }, orderBy: { receivedOn: "desc" } }),
    prisma.paymentAdjustment.findMany({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({
    invoice: serializeInvoice(invoice),
    lines: lines.map(serializeLine),
    receivable: serializeReceivable(receivable),
    payments: payments.map(serializePayment),
    adjustments: adjustments.map(serializeAdjustment),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_CREATE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await loadInvoice(ctx.tenantId, id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Governed status change: never via PATCH (ADR-0009).
  if ("status" in body) return NextResponse.json({ error: "Status changes are governed actions", code: "GOVERNED_ACTION" }, { status: 400 });

  if (!isDraftEditable(invoice)) return NextResponse.json({ error: "Only draft invoices can be edited" }, { status: 409 });

  const data: any = {};
  if (body.paymentTermsDays !== undefined) {
    if (!Number.isInteger(body.paymentTermsDays) || body.paymentTermsDays < 0) return NextResponse.json({ error: "paymentTermsDays must be a non-negative integer" }, { status: 400 });
    data.paymentTermsDays = body.paymentTermsDays;
  }
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes : null;
  if (body.dueOn !== undefined) data.dueOn = body.dueOn ? new Date(body.dueOn) : null;
  if (body.taxCents !== undefined) {
    if (!Number.isInteger(body.taxCents) || body.taxCents < 0) return NextResponse.json({ error: "taxCents must be non-negative integer cents" }, { status: 400 });
    const subtotal = invoice.subtotalCents;
    data.taxCents = BigInt(body.taxCents);
    data.totalCents = subtotal + BigInt(body.taxCents);
  }
  if (body.projectId !== undefined) {
    if (body.projectId) {
      const project = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!project) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }
    data.projectId = body.projectId ?? null;
  }

  const updated = await prisma.invoice.update({ where: { id: invoice.id }, data });
  return NextResponse.json({ invoice: serializeInvoice(updated) });
}
