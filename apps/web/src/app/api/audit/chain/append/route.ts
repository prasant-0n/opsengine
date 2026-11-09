import { NextRequest, NextResponse } from "next/server";
import { globalAuditChainService } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { error: "x-tenant-id header or tenantId body parameter is required" },
        { status: 400 }
      );
    }

    if (!body.eventType) {
      return NextResponse.json(
        { error: "eventType is required to append an audit record" },
        { status: 400 }
      );
    }

    const signingKey = body.signingKey || req.headers.get("x-audit-signing-key") || undefined;

    const record = await globalAuditChainService.appendRecord(
      tenantId,
      {
        actorUserId: body.actorUserId,
        eventType: body.eventType,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        decision: body.decision,
        reasonCode: body.reasonCode,
        policyVersion: body.policyVersion,
        metadata: body.metadata,
        createdAt: body.createdAt,
      },
      signingKey
    );

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to append audit record", details: err?.message },
      { status: 500 }
    );
  }
}
