import { NextRequest, NextResponse } from "next/server";
import { globalWebhookEngine } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;
    const webhookId = body.webhookId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId is required" },
        { status: 400 }
      );
    }

    if (!webhookId) {
      return NextResponse.json(
        { error: "webhookId parameter is required" },
        { status: 400 }
      );
    }

    const endpoint = globalWebhookEngine.getEndpoint(tenantId, webhookId);
    if (!endpoint) {
      return NextResponse.json(
        { error: "Webhook endpoint not found or cross-tenant access denied" },
        { status: 404 }
      );
    }

    // Schedule test event
    const [scheduledDelivery] = globalWebhookEngine.scheduleDeliveriesForEvent({
      id: `test-event-${Date.now()}`,
      name: "ping.test.v1",
      tenantId,
      payload: {
        message: "This is a test webhook delivery from OpsEngine",
        timestamp: new Date().toISOString(),
        test: true,
      },
    });

    if (!scheduledDelivery) {
      // If endpoint doesn't subscribe to ping.test.v1, temporarily force delivery for testing
      const delivery = await globalWebhookEngine.scheduleDeliveriesForEvent({
        id: `test-event-${Date.now()}`,
        name: endpoint.eventTypes[0] || "ping.test.v1",
        tenantId,
        payload: {
          message: "Test webhook verification",
          timestamp: new Date().toISOString(),
          test: true,
        },
      });
      return NextResponse.json({
        success: true,
        delivery: delivery[0],
      });
    }

    // Dispatch the test delivery
    const result = await globalWebhookEngine.dispatchDelivery(scheduledDelivery.id);

    return NextResponse.json({
      success: true,
      delivery: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to dispatch test webhook", details: message },
      { status: 500 }
    );
  }
}
