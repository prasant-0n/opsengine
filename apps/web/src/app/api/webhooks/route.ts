import { NextRequest, NextResponse } from "next/server";
import { globalWebhookEngine } from "@/lib/webhooks";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = req.headers.get("x-tenant-id") || searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId query parameter is required" },
        { status: 400 }
      );
    }

    const endpoints = globalWebhookEngine.getEndpoints(tenantId);
    return NextResponse.json({
      success: true,
      total: endpoints.length,
      endpoints,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to list webhook endpoints", details: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId is required" },
        { status: 400 }
      );
    }

    const endpoint = globalWebhookEngine.registerEndpoint(tenantId, {
      name: body.name,
      url: body.url,
      secret: body.secret,
      eventTypes: body.eventTypes,
      rateLimitPerMinute: body.rateLimitPerMinute,
      description: body.description,
    });

    return NextResponse.json(
      {
        success: true,
        endpoint,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isClientError = message.includes("required") || message.includes("Invalid webhook destination URL");
    return NextResponse.json(
      { error: "Failed to create webhook endpoint", details: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
