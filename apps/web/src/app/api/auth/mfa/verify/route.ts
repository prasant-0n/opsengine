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
        { error: "userId, tenantId, and code are required to verify MFA" },
        { status: 400 }
      );
    }

    const result = globalMfaService.verify(userId, tenantId, code);
    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || "MFA verification failed" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      method: result.method,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to verify MFA code", details: err?.message },
      { status: 500 }
    );
  }
}
