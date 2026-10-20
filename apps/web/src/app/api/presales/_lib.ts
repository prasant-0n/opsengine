import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, type AuthorizationContext } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/permissions/permissions";

export interface AuthzResult {
  ctx: AuthorizationContext;
}

export async function requirePresalesAuthz(
  permission: PermissionKey,
  resource: { resourceType: string; owningEmployeeId?: string | null },
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

export function serializeProposal(prop: any) {
  return {
    ...prop,
    totalAmountCents: prop.totalAmountCents?.toString() ?? "0",
    lines: (prop.lines ?? []).map((l: any) => ({
      ...l,
      hourlyRateCents: l.hourlyRateCents?.toString() ?? "0",
      totalCents: l.totalCents?.toString() ?? "0",
    })),
  };
}
