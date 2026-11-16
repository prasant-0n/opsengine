import { NextRequest, NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/auth/portal-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  const { tenantId, accountId } = auth.ctx;

  // Invoices for this client account (excluding internal drafts)
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      accountId,
      status: { in: ["issued", "partially_paid", "paid", "overdue"] },
    },
    orderBy: { issuedOn: "desc" },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const receivables = invoiceIds.length
    ? await prisma.receivable.findMany({
        where: { tenantId, invoiceId: { in: invoiceIds } },
      })
    : [];

  const recMap = new Map(receivables.map((r) => [r.invoiceId, r]));

  const enriched = invoices.map((inv) => {
    const rec = recMap.get(inv.id);
    const subtotalCents = Number(inv.subtotalCents);
    const taxCents = Number(inv.taxCents);
    const totalCents = Number(inv.totalCents);
    const paidCents = rec ? Number(rec.paidAmountCents) : inv.status === "paid" ? totalCents : 0;
    const outstandingCents = rec
      ? Number(rec.outstandingCents)
      : inv.status === "paid"
      ? 0
      : totalCents;

    return {
      id: inv.id,
      number: inv.number,
      currency: inv.currency,
      status: inv.status,
      issuedOn: inv.issuedOn,
      dueOn: inv.dueOn,
      subtotalFormatted: `$${(subtotalCents / 100).toFixed(2)}`,
      taxFormatted: `$${(taxCents / 100).toFixed(2)}`,
      totalFormatted: `$${(totalCents / 100).toFixed(2)}`,
      paidFormatted: `$${(paidCents / 100).toFixed(2)}`,
      outstandingFormatted: `$${(outstandingCents / 100).toFixed(2)}`,
      isPayable: inv.status !== "paid" && outstandingCents > 0,
      checkoutUrl: `/api/finance/invoices/${inv.id}/payment-link`,
    };
  });

  return NextResponse.json({
    data: enriched,
    total: enriched.length,
  });
}
