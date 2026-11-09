import { NextRequest, NextResponse } from "next/server";
import { globalAuditChainService } from "@/lib/audit";

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

    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const result = await globalAuditChainService.getRecords(tenantId, { limit, offset });

    return NextResponse.json({
      success: true,
      tenantId,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to retrieve audit records", details: err?.message },
      { status: 500 }
    );
  }
}
