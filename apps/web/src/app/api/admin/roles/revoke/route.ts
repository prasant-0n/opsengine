import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { revokeRoleGrant } from "@/features/admin/lib/admin-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.ORG_MANAGE_ROLES, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.grantId) {
      return NextResponse.json({ error: "grantId is required" }, { status: 400 });
    }
    const result = await revokeRoleGrant(ctx.tenantId, ctx.userId, body.grantId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to revoke role grant" }, { status: 400 });
  }
}
