import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.ERP_SYNC_READ, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "erp_sync_log",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const entityType = searchParams.get("entityType");

  const whereClause: {
    tenantId: string;
    status?: string;
    entityType?: string;
  } = {
    tenantId: ctx.tenantId,
  };

  if (status) whereClause.status = status;
  if (entityType) whereClause.entityType = entityType;

  const logs = await prisma.erpSyncLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: logs });
}
