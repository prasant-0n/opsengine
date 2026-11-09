import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { decideLeave } from "@/features/leave/lib/leave-service";

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

  const authz = authorize(ctx, PERMISSIONS.LEAVE_REQUEST_APPROVE, {
    tenantId: ctx.tenantId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { decision, reviewNotes } = body;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  try {
    const updated = await decideLeave({
      tenantId: ctx.tenantId,
      requestId: id,
      reviewerEmployeeId: ctx.employeeId,
      decision,
      reviewNotes,
    });
    return NextResponse.json({ request: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to decide leave request" }, { status: 400 });
  }
}
