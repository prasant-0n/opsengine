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

    const { proposalId, userId, userPermissions = [] } = body;
    if (!proposalId || !userId) {
      return NextResponse.json(
        { error: "proposalId and userId are required" },
        { status: 400 }
      );
    }

    const result = await globalAiGuardrailEngine.confirmProposal(
      tenantId,
      userId,
      userPermissions,
      proposalId
    );

    return NextResponse.json({
      ...result,
    });
  } catch (err: any) {
    const isSecurityError =
      err?.message?.includes("Access Denied") ||
      err?.message?.includes("Security Policy Violation") ||
      err?.message?.includes("forbidden");

    return NextResponse.json(
      { error: err?.message || "Failed to confirm proposal" },
      { status: isSecurityError ? 403 : 500 }
    );
  }
}
