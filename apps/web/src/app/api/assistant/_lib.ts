import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, type AuthorizationContext } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/permissions/permissions";

export interface AuthzResult {
  ctx: AuthorizationContext;
}

export async function requireAssistantAuthz(permission: PermissionKey): Promise<AuthzResult | NextResponse> {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, permission, {
    tenantId: ctx.tenantId,
    resourceType: "assistant",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return { ctx };
}

export function isResponse(v: AuthzResult | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
