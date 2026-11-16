import { NextRequest, NextResponse } from "next/server";
import { globalPaymentGatewayService } from "@/lib/payment-gateway";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const result = await globalPaymentGatewayService.processWebhook("stripe", rawBody, signature);

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      paymentId: result.payment.id,
      transactionReference: result.payment.transactionReference,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isAuth = message.includes("signature") || message.includes("Invalid");
    return NextResponse.json(
      { error: "Stripe webhook processing failed", details: message },
      { status: isAuth ? 401 : 500 }
    );
  }
}
