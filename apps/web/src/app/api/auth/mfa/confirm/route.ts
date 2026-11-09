import { NextRequest, NextResponse } from "next/server";
import { globalMfaService } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;
    const userId = body.userId;
    const code = body.code;

    if (!userId || !tenantId || !code) {
      return NextResponse.json(
        { error: "userId, tenantId, and code are required to confirm MFA" },
        { status: 400 }
      );
    }

    const result = globalMfaService.confirm(userId, tenantId, code);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to confirm MFA code" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: "ACTIVE",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to confirm MFA setup", details: err?.message },
      { status: 500 }
    );
  }
}
