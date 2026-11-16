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

    const dlq = globalWebhookEngine.getDeadLetterQueue(tenantId);
    return NextResponse.json({
      success: true,
      total: dlq.length,
      dlq,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to list DLQ deliveries", details: message },
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

    const autoDispatch = body.autoDispatch ?? false;
    const replayed = await globalWebhookEngine.replayAllDeadLetter(tenantId, autoDispatch);

    return NextResponse.json({
      success: true,
      replayedCount: replayed.length,
      replayed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to replay DLQ items", details: message },
      { status: 500 }
    );
  }
}
