import { NextRequest, NextResponse } from "next/server";
import { globalAuditChainService } from "@/lib/audit";

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

    const startSeq = body.startSequence ? parseInt(body.startSequence, 10) : 1;
    const endSeq = body.endSequence ? parseInt(body.endSequence, 10) : undefined;

    const proof = await globalAuditChainService.generateProof(tenantId, startSeq, endSeq);

    return NextResponse.json({
      success: true,
      proof,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate audit proof", details: err?.message },
      { status: 500 }
    );
  }
}
