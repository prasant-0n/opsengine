import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { setTenantLifecycleStatus } from "@/features/control-plane/lib/control-plane-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.authUser.findUnique({ where: { id: ctx.userId } });
  const authz = authorize(ctx, PERMISSIONS.CONTROL_PLANE_MANAGE, { tenantId: ctx.tenantId });
  if (!user?.isSuperadmin && !user?.isRootAdmin && !authz.allowed) {
    return NextResponse.json({ error: "Forbidden: operator access required" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const { status, reason } = body;
    if (!["active", "suspended", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid lifecycle status" }, { status: 400 });
    }

    const updated = await setTenantLifecycleStatus(id, ctx.userId, status, reason);
    return NextResponse.json({ workspace: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update tenant lifecycle" },
      { status: 400 }
    );
  }
}
