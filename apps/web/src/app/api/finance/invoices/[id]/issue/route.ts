import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice, serializeReceivable } from "../../../_lib";
import { canIssue } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_ISSUE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canIssue(invoice)) return NextResponse.json({ error: "Only draft invoices can be issued" }, { status: 409 });

  const lineCount = await prisma.invoiceLine.count({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id } });
  if (lineCount === 0) return NextResponse.json({ error: "Invoice has no line items" }, { status: 400 });

  const now = new Date();
  const dueOn = new Date(now.getTime() + invoice.paymentTermsDays * 24 * 60 * 60 * 1000);

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "issued", issuedOn: now, dueOn },
  });
  const receivable = await prisma.receivable.create({
    data: {
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      originalAmountCents: updated.totalCents,
      paidAmountCents: 0n,
      outstandingCents: updated.totalCents,
      currency: updated.currency,
      dueOn,
      status: "open",
    },
  });
  await prisma.stageHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityType: "invoice",
      entityId: invoice.id,
      fromStatus: "draft",
      toStatus: "issued",
      actorId: ctx.userId,
      reason: null,
    },
  });
  return NextResponse.json({ invoice: serializeInvoice(updated), receivable: serializeReceivable(receivable) });
}
