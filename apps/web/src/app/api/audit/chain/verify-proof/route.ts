import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { AuditChainService } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const sessionToken = await getSessionToken();
    if (sessionToken) {
      const ctx = await buildAuthContext(sessionToken);
      if (ctx) {
        const authz = authorize(ctx, PERMISSIONS.AUDIT_READ, { tenantId: ctx.tenantId });
        if (!authz.allowed) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const proof = body?.proof;
    const signingKey = body?.signingKey || undefined;
    const verification = AuditChainService.verifyProof(proof, signingKey);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Proof verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...verification,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to verify audit proof", details: err?.message },
      { status: 500 }
    );
  }
}
