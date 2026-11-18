import { NextRequest, NextResponse } from "next/server";
import { globalMfaService, rateLimit, clientIp } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!rateLimit(`mfa-verify:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof req.headers.get("x-tenant-id") === "string" ? req.headers.get("x-tenant-id")! : (typeof body?.tenantId === "string" ? body.tenantId : "");
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const code = typeof body?.code === "string" ? body.code : "";

    const result = globalMfaService.verify(userId, tenantId, code);
    if (!result.valid) {
      const status = result.error?.includes("required") ? 400 : 401;
      return NextResponse.json(
        { error: result.error || "MFA verification failed" },
        { status }
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
