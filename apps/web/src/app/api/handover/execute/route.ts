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

    if (!body.handoverId || !body.executorUserId) {
      return NextResponse.json(
        { error: "handoverId and executorUserId are required" },
        { status: 400 }
      );
    }

    const result = await globalLifecycleOrchestrator.executeHandover(
      tenantId,
      body.handoverId,
      body.executorUserId
    );

    return NextResponse.json({
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to execute handover", details: err?.message },
      { status: 500 }
    );
  }
}
