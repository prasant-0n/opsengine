import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, type AuthorizationContext } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/permissions/permissions";

export interface AuthzResult {
  ctx: AuthorizationContext;
}

// Standard auth + authorization guard used by every offer route.
export async function requireOfferAuthz(
  permission: PermissionKey,
  resource: { resourceType: string; owningEmployeeId?: string | null } = { resourceType: "offer" },
): Promise<AuthzResult | NextResponse> {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, permission, {
    tenantId: ctx.tenantId,
    resourceType: resource.resourceType,
    owningEmployeeId: resource.owningEmployeeId ?? undefined,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return { ctx };
}

export function isResponse(v: AuthzResult | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}

// Money fields are BigInt in storage; serialize them as strings in JSON.
export function serializeOffer(o: any) {
  return {
    ...o,
    baseCompCents: o.baseCompCents?.toString() ?? "0",
    variableCents: o.variableCents !== null && o.variableCents !== undefined ? o.variableCents.toString() : null,
  };
}

export function serializeOfferTemplate(t: any) {
  return { ...t };
}
