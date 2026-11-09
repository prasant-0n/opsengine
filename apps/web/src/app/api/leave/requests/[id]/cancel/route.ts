import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { cancelLeave } from "@/features/leave/lib/leave-service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!ctx.employeeId) {
    return NextResponse.json({ error: "No employee profile found" }, { status: 400 });
  }

  const authz = authorize(ctx, PERMISSIONS.LEAVE_REQUEST_CREATE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const updated = await cancelLeave({
      tenantId: ctx.tenantId,
      requestId: id,
      employeeId: ctx.employeeId,
    });
    return NextResponse.json({ request: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to cancel leave request" }, { status: 400 });
  }
}
