import { NextRequest, NextResponse } from "next/server";
import { globalWebhookEngine } from "@/lib/webhooks";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const tenantId = req.headers.get("x-tenant-id") || searchParams.get("tenantId");
    const status = searchParams.get("status") || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId query parameter is required" },
        { status: 400 }
      );
    }

    const endpoint = globalWebhookEngine.getEndpoint(tenantId, id);
    if (!endpoint) {
      return NextResponse.json(
        { error: "Webhook endpoint not found or cross-tenant access denied" },
        { status: 404 }
      );
    }

    const deliveries = globalWebhookEngine.getDeliveries(tenantId, id, status);
    return NextResponse.json({
      success: true,
      webhookId: id,
      total: deliveries.length,
      deliveries,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to list webhook deliveries", details: message },
      { status: 500 }
    );
  }
}
