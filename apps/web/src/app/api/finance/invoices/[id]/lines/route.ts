import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice, serializeLine } from "../../../_lib";
import { isDraftEditable, deriveLineAmount, isValidQuantity, isValidAmountCents } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

async function recalcInvoiceTotals(tenantId: string, invoiceId: string) {
  const lines = await prisma.invoiceLine.findMany({ where: { tenantId, invoiceId } });
  const subtotal = lines.reduce((acc, l) => acc + l.amountCents, 0n);
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  const tax = invoice?.taxCents ?? 0n;
  return prisma.invoice.update({ where: { id: invoiceId }, data: { subtotalCents: subtotal, totalCents: subtotal + tax } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_LINE_MANAGE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isDraftEditable(invoice)) return NextResponse.json({ error: "Only draft invoices can be edited" }, { status: 409 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.description || typeof body.description !== "string") return NextResponse.json({ error: "Missing description" }, { status: 400 });
  const quantity = body.quantity ?? 1;
  if (!isValidQuantity(quantity)) return NextResponse.json({ error: "quantity must be a positive integer" }, { status: 400 });
  if (!isValidAmountCents(body.unitPriceCents)) return NextResponse.json({ error: "unitPriceCents must be non-negative integer cents" }, { status: 400 });
  if (body.projectId) {
    const project = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const existing = await prisma.invoiceLine.count({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id } });
  const amountCents = BigInt(deriveLineAmount(quantity, body.unitPriceCents));
  const line = await prisma.invoiceLine.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      lineNumber: existing + 1,
      description: body.description,
      quantity,
      unitPriceCents: BigInt(body.unitPriceCents),
      amountCents,
      projectId: body.projectId ?? null,
      milestoneId: body.milestoneId ?? null,
    },
  });
  const updated = await recalcInvoiceTotals(ctx.tenantId, invoice.id);
  return NextResponse.json({ line: serializeLine(line), invoice: serializeInvoice(updated) }, { status: 201 });
}
