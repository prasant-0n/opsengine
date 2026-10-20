import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice } from "../../../../../_lib";
import { isDraftEditable } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_LINE_MANAGE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id, lineId } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isDraftEditable(invoice)) return NextResponse.json({ error: "Only draft invoices can be edited" }, { status: 409 });

  const line = await prisma.invoiceLine.findFirst({ where: { id: lineId, invoiceId: invoice.id, tenantId: ctx.tenantId } });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.invoiceLine.delete({ where: { id: line.id } });

  const remaining = await prisma.invoiceLine.findMany({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id }, orderBy: { lineNumber: "asc" } });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].lineNumber !== i + 1) {
      await prisma.invoiceLine.update({ where: { id: remaining[i].id }, data: { lineNumber: i + 1 } });
    }
  }
  const subtotal = remaining.reduce((acc, l) => acc + l.amountCents, 0n);
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { subtotalCents: subtotal, totalCents: subtotal + invoice.taxCents },
  });
  return NextResponse.json({ invoice: serializeInvoice(updated) });
}
