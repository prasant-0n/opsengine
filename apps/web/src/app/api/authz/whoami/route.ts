import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext } from "@/lib/permissions";

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const ctx = await buildAuthContext(token);
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  // Return safe projection (no internal audit refs)
  return NextResponse.json({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    employeeId: ctx.employeeId,
    membershipStatus: ctx.membershipStatus,
    assurance: ctx.assurance,
    permissions: ctx.permissions,
    roles: ctx.roles,
    teamMemberships: ctx.teamMemberships,
    reporting: ctx.reporting,
    accessGroupIds: ctx.accessGroupIds,
    policyVersion: ctx.policyVersion,
    builtAt: ctx.builtAt,
  });
}
