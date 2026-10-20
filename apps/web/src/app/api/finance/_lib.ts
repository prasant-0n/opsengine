import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, type AuthorizationContext } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/permissions/permissions";

export interface AuthzResult {
  ctx: AuthorizationContext;
}

// Standard auth + authorization guard used by every finance route.
// Returns either an AuthzResult (allowed) or a NextResponse error (deny).
export async function requireFinanceAuthz(
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

// Money fields are BigInt in storage; serialize them as strings in JSON.
export function serializeInvoice(inv: any) {
  return {
    ...inv,
    subtotalCents: inv.subtotalCents?.toString() ?? "0",
    taxCents: inv.taxCents?.toString() ?? "0",
    totalCents: inv.totalCents?.toString() ?? "0",
  };
}

export function serializeLine(line: any) {
  return {
    ...line,
    unitPriceCents: line.unitPriceCents?.toString() ?? "0",
    amountCents: line.amountCents?.toString() ?? "0",
  };
}

export function serializeReceivable(r: any) {
  if (!r) return null;
  return {
    ...r,
    originalAmountCents: r.originalAmountCents?.toString() ?? "0",
    paidAmountCents: r.paidAmountCents?.toString() ?? "0",
    outstandingCents: r.outstandingCents?.toString() ?? "0",
  };
}

export function serializePayment(p: any) {
  return { ...p, amountCents: p.amountCents?.toString() ?? "0" };
}

export function serializeAdjustment(a: any) {
  return { ...a, amountCents: a.amountCents?.toString() ?? "0" };
}
