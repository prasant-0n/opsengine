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

    if (!body.handoverId || !body.userId || !body.role) {
      return NextResponse.json(
        { error: "handoverId, userId, and role are required" },
        { status: 400 }
      );
    }

    const context = await globalLifecycleOrchestrator.recordApproval(tenantId, {
      handoverId: body.handoverId,
      userId: body.userId,
      role: body.role,
      comments: body.comments,
    });

    return NextResponse.json({
      success: true,
      context,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to record approval", details: err?.message },
      { status: 400 }
    );
  }
}
