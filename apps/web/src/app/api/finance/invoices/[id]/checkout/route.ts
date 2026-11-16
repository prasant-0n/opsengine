import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse } from "../../../_lib";
import { globalPaymentGatewayService, PaymentGatewayProvider } from "@/lib/payment-gateway";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_READ, { resourceType: "invoice" });
    if (isResponse(auth)) return auth;
    const { ctx } = auth;
    const { id } = await context.params;

    const body = await req.json().catch(() => ({}));
    const provider: PaymentGatewayProvider = body.provider || "stripe";
    const returnUrl = body.returnUrl;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found or access denied" }, { status: 404 });
    }

    if (invoice.status === "draft") {
      return NextResponse.json({ error: "Cannot create checkout for draft invoice. Issue invoice first." }, { status: 409 });
    }
    if (invoice.status === "void") {
      return NextResponse.json({ error: "Cannot create checkout for void invoice." }, { status: 409 });
    }
    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice has already been fully paid." }, { status: 409 });
    }

    const receivable = await prisma.receivable.findFirst({
      where: { tenantId: ctx.tenantId, invoiceId: invoice.id },
    });

    const amountCents = receivable ? Number(receivable.outstandingCents) : Number(invoice.totalCents);

    const session = await globalPaymentGatewayService.createCheckoutSession({
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      amountCents,
      currency: invoice.currency,
      provider,
      returnUrl,
    });

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: message },
      { status: 500 }
    );
  }
}
