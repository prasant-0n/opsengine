import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext } from "@/lib/permissions";
import { authorize } from "@/lib/permissions/engine";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const ctx = await buildAuthContext(token);
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const cursor = searchParams.get("cursor");

  const authz = authorize(ctx, PERMISSIONS.AUDIT_READ, {
    tenantId: ctx.tenantId,
    resourceType: "audit_event",
  });
  if (!authz.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: any = { tenantId: ctx.tenantId };
  if (cursor) {
    where.id = { lt: cursor };
  }
  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { id: "desc" },
    take: limit,
  });
  const nextCursor = events.length === limit ? events[events.length - 1].id : null;
  return NextResponse.json({ events, nextCursor });
}
