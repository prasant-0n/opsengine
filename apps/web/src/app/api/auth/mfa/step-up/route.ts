import { NextRequest, NextResponse } from "next/server";
import { globalMfaService, StepUpScope } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;
    const userId = body.userId;
    const code = body.code;
    const scope = (body.scope as StepUpScope) || "TENANT_ADMIN";

    if (!userId || !tenantId || !code) {
      return NextResponse.json(
        { error: "userId, tenantId, and code are required for step-up elevation" },
        { status: 400 }
      );
    }

    const result = globalMfaService.issueStepUp(userId, tenantId, code, scope);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Step-up verification failed" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      stepUpToken: result.stepUpToken,
      expiresAt: result.expiresAt,
      scope,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to issue step-up token", details: err?.message },
      { status: 500 }
    );
  }
}
