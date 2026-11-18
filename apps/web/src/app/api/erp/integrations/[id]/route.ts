import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.ERP_CONFIG_MANAGE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "erp_integration",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.erpIntegration.findUnique({
    where: { id },
  });

  if (!existing || existing.tenantId !== ctx.tenantId) {
    return NextResponse.json({ error: "ERP integration not found" }, { status: 404 });
  }

  await prisma.erpIntegration.update({
    where: { id },
    data: {
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
    },
  });

  return NextResponse.json({ message: "ERP integration disconnected successfully." });
}
