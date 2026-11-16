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

    return NextResponse.json({
      success: true,
      endpoint,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to get webhook endpoint", details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
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

    const updated = globalWebhookEngine.updateEndpoint(tenantId, id, body);
    return NextResponse.json({
      success: true,
      endpoint: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotFound = message.includes("not found");
    const isBadRequest = message.includes("Invalid webhook destination URL");
    return NextResponse.json(
      { error: "Failed to update webhook endpoint", details: message },
      { status: isNotFound ? 404 : isBadRequest ? 400 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const tenantId = req.headers.get("x-tenant-id") || searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId query parameter is required" },
        { status: 400 }
      );
    }

    const deleted = globalWebhookEngine.deleteEndpoint(tenantId, id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Webhook endpoint not found or cross-tenant access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to delete webhook endpoint", details: message },
      { status: 500 }
    );
  }
}
