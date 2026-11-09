import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamLeaveCalendar } from "@/features/leave/lib/leave-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.LEAVE_REQUEST_READ_SELF, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || defaultTo;

  try {
    const calendar = await getTeamLeaveCalendar(ctx.tenantId, from, to);
    return NextResponse.json({ calendar, from, to });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch team leave calendar" }, { status: 500 });
  }
}
