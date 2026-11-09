import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getLeaveBalances } from "@/features/leave/lib/leave-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || ctx.employeeId;
  const year = parseInt(searchParams.get("year") || String(new Date().getUTCFullYear()), 10);

  if (!employeeId) {
    return NextResponse.json({ error: "No employee profile found" }, { status: 400 });
  }

  // If requesting other employee's balances, check permission
  const isSelf = employeeId === ctx.employeeId;
  const permission = isSelf ? PERMISSIONS.LEAVE_BALANCE_READ_SELF : PERMISSIONS.LEAVE_BALANCE_READ_TEAM;
  const authz = authorize(ctx, permission, {
    tenantId: ctx.tenantId,
    owningEmployeeId: employeeId,
  });

  if (!authz.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const balances = await getLeaveBalances(ctx.tenantId, employeeId, year);
    return NextResponse.json({ balances, year });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch leave balances" }, { status: 500 });
  }
}
