import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isValidMinutes } from "@/features/time/lib/time";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_ENTRY_UPDATE, {
    tenantId: ctx.tenantId,
    resourceType: "time_entry",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entry = await prisma.timeEntry.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry.employeeId !== ctx.employeeId) {
    return NextResponse.json({ error: "Cannot edit another employee's time entry" }, { status: 403 });
  }

  const data: any = {};
  if (body.minutes !== undefined) {
    const m = typeof body.minutes === "string" ? parseInt(body.minutes, 10) : body.minutes;
    if (!isValidMinutes(m)) return NextResponse.json({ error: "minutes must be integer 1–1440" }, { status: 400 });
    data.minutes = m;
  }
  if (body.billable !== undefined) data.billable = !!body.billable;
  if (body.note !== undefined) data.note = body.note;
  if (body.projectId !== undefined) {
    if (body.projectId) {
      const ok = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }
    data.projectId = body.projectId ?? null;
  }
  if (body.ticketId !== undefined) {
    if (body.ticketId) {
      const ok = await prisma.ticket.findFirst({ where: { id: body.ticketId, tenantId: ctx.tenantId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Invalid ticketId" }, { status: 400 });
    }
    data.ticketId = body.ticketId ?? null;
  }

  const updated = await prisma.timeEntry.update({ where: { id }, data });
  return NextResponse.json({ entry: updated });
}
