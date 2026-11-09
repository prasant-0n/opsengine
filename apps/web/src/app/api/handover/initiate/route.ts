import { NextRequest, NextResponse } from "next/server";
import { globalLifecycleOrchestrator } from "@/lib/orchestration";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId parameter is required" },
        { status: 400 }
      );
    }

    if (!body.type || !body.sourceEntityId || !body.initiatorUserId) {
      return NextResponse.json(
        { error: "type, sourceEntityId, and initiatorUserId are required" },
        { status: 400 }
      );
    }

    const context = await globalLifecycleOrchestrator.initiateHandover(tenantId, {
      type: body.type,
      sourceEntityId: body.sourceEntityId,
      sourceEntityType: body.sourceEntityType || "source_entity",
      initiatorUserId: body.initiatorUserId,
      payload: body.payload || {},
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      context,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to initiate handover", details: err?.message },
      { status: 500 }
    );
  }
}
