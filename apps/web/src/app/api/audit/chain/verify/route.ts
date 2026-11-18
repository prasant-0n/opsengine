import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { globalAuditChainService } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const sessionToken = await getSessionToken();
    const ctx = sessionToken ? await buildAuthContext(sessionToken) : null;
    const tenantId = ctx?.tenantId || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant context or authentication is required" },
        { status: 401 }
      );
    }

    if (ctx) {
      const authz = authorize(ctx, PERMISSIONS.AUDIT_READ, { tenantId: ctx.tenantId });
      if (!authz.allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const signingKey = body.signingKey || req.headers.get("x-audit-signing-key") || undefined;
    const result = await globalAuditChainService.verifyChain(tenantId, signingKey);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to verify audit chain", details: err?.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionToken = await getSessionToken();
    const ctx = sessionToken ? await buildAuthContext(sessionToken) : null;
    const tenantId = ctx?.tenantId || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant context or authentication is required" },
        { status: 401 }
      );
    }

    if (ctx) {
      const authz = authorize(ctx, PERMISSIONS.AUDIT_READ, { tenantId: ctx.tenantId });
      if (!authz.allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await globalAuditChainService.verifyChain(tenantId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to verify audit chain", details: err?.message },
      { status: 500 }
    );
  }
}
