import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, writeAudit } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { exportAuditEventsCsv } from "@/features/reporting/lib/reporting-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.AUDIT_READ, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const eventType = searchParams.get("eventType") || undefined;
  const decision = searchParams.get("decision") || undefined;

  try {
    const csv = await exportAuditEventsCsv(ctx.tenantId, { eventType, decision });

    // Log the export event
    writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      eventType: "audit.export",
      resourceType: "audit_events",
      resourceId: null,
      decision: "allow",
      reasonCode: "USER_EXPORT",
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-events-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to export audit events" }, { status: 500 });
  }
}
