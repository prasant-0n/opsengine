import { NextRequest, NextResponse } from "next/server";
import { globalWebhookEngine } from "@/lib/webhooks";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId is required" },
        { status: 400 }
      );
    }

    const autoDispatch = body.autoDispatch ?? true;
    const replayed = await globalWebhookEngine.replayDelivery(tenantId, id, autoDispatch);

    return NextResponse.json({
      success: true,
      message: "Webhook delivery replayed successfully",
      delivery: replayed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound = message.includes("not found") || message.includes("cross-tenant");
    return NextResponse.json(
      { error: "Failed to replay delivery", details: message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
