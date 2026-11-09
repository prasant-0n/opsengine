import { NextRequest, NextResponse } from "next/server";
import { globalAiGuardrailEngine } from "@/lib/ai-guardrails";

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

    const { proposalId, userId, reason } = body;
    if (!proposalId || !userId) {
      return NextResponse.json(
        { error: "proposalId and userId are required" },
        { status: 400 }
      );
    }

    const result = await globalAiGuardrailEngine.rejectProposal(
      tenantId,
      userId,
      proposalId,
      reason
    );

    return NextResponse.json({
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to reject proposal" },
      { status: 500 }
    );
  }
}
