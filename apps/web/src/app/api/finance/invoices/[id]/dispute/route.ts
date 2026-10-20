import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice } from "../../../_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_ISSUE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status === "draft" || invoice.status === "void") {
    return NextResponse.json({ error: "Disputes apply to issued invoices only" }, { status: 409 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "raise" && action !== "resolve") return NextResponse.json({ error: "action must be raise or resolve" }, { status: 400 });
  if (action === "raise" && (!body.reason || typeof body.reason !== "string" || !body.reason.trim())) {
    return NextResponse.json({ error: "A reason is required to raise a dispute" }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      disputeStatus: action === "raise" ? "raised" : "resolved",
      disputeReason: action === "raise" ? body.reason : invoice.disputeReason,
    },
  });
  const receivable = await prisma.receivable.findFirst({ where: { tenantId: ctx.tenantId, invoiceId: invoice.id } });
  if (receivable) {
    await prisma.receivable.update({
      where: { id: receivable.id },
      data: { status: action === "raise" ? "disputed" : receivable.outstandingCents === 0n ? "paid" : receivable.paidAmountCents > 0n ? "partially_paid" : "open" },
    });
  }
  return NextResponse.json({ invoice: serializeInvoice(updated) });
}
