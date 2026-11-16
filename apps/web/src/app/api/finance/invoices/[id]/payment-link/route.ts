import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse } from "../../../_lib";
import { globalPaymentGatewayService } from "@/lib/payment-gateway";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_READ, { resourceType: "invoice" });
    if (isResponse(auth)) return auth;
    const { ctx } = auth;
    const { id } = await context.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found or access denied" }, { status: 404 });
    }

    const receivable = await prisma.receivable.findFirst({
      where: { tenantId: ctx.tenantId, invoiceId: invoice.id },
    });

    const amountCents = receivable ? Number(receivable.outstandingCents) : Number(invoice.totalCents);
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    const link = globalPaymentGatewayService.generatePaymentLink(
      ctx.tenantId,
      invoice.id,
      amountCents,
      invoice.currency,
      baseUrl
    );

    return NextResponse.json({
      success: true,
      invoiceNumber: invoice.number,
      amountCents,
      currency: invoice.currency,
      ...link,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to generate payment link", details: message },
      { status: 500 }
    );
  }
}
