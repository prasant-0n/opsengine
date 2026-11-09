import { NextRequest, NextResponse } from "next/server";
import { globalMfaService } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId;
    const userId = body.userId;
    const email = body.email;

    if (!userId || !tenantId || !email) {
      return NextResponse.json(
        { error: "userId, tenantId, and email are required to setup MFA" },
        { status: 400 }
      );
    }

    const setupResult = globalMfaService.setup(userId, tenantId, email);

    return NextResponse.json({
      success: true,
      ...setupResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to initiate MFA setup", details: err?.message },
      { status: 500 }
    );
  }
}
