import { NextRequest, NextResponse } from "next/server";
import { globalLifecycleOrchestrator, HandoverStatus, HandoverLifecycleType } from "@/lib/orchestration";

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

    const id = searchParams.get("id");
    if (id) {
      const handover = globalLifecycleOrchestrator.getHandover(tenantId, id);
      if (!handover) {
        return NextResponse.json({ error: "Handover not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, handover });
    }

    const status = searchParams.get("status") as HandoverStatus | undefined;
    const type = searchParams.get("type") as HandoverLifecycleType | undefined;

    const handovers = globalLifecycleOrchestrator.listHandovers(tenantId, { status, type });

    return NextResponse.json({
      success: true,
      tenantId,
      total: handovers.length,
      handovers,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch handovers", details: err?.message },
      { status: 500 }
    );
  }
}
