import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Request a correction to an attendance day (e.g. missed check-out).
// The original punches are preserved; this is an additional append-only record.
export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_ATTENDANCE_CORRECT, {
    tenantId: ctx.tenantId,
    resourceType: "attendance_correction",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.attendanceDayId) return NextResponse.json({ error: "Missing attendanceDayId" }, { status: 400 });
  if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "Missing reason" }, { status: 400 });
  }

  const day = await prisma.attendanceDay.findFirst({ where: { id: body.attendanceDayId, tenantId: ctx.tenantId } });
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (day.employeeId !== ctx.employeeId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const proposedCheckIn = body.proposedCheckIn ? new Date(body.proposedCheckIn) : null;
  const proposedCheckOut = body.proposedCheckOut ? new Date(body.proposedCheckOut) : null;
  if (proposedCheckIn && isNaN(proposedCheckIn.getTime())) return NextResponse.json({ error: "Invalid proposedCheckIn" }, { status: 400 });
  if (proposedCheckOut && isNaN(proposedCheckOut.getTime())) return NextResponse.json({ error: "Invalid proposedCheckOut" }, { status: 400 });

  const correction = await prisma.$transaction(async (tx) => {
    const c = await tx.attendanceCorrection.create({
      data: {
        tenantId: ctx.tenantId,
        attendanceDayId: day.id,
        requestedBy: ctx.userId,
        reason: body.reason,
        proposedCheckIn,
        proposedCheckOut,
        status: "pending",
      },
    });
    // Flag the day as correction_requested (punches preserved).
    await tx.attendanceDay.update({ where: { id: day.id }, data: { status: "correction_requested" } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "attendance_correction",
        entityId: c.id,
        fromStatus: null,
        toStatus: "pending",
        actorId: ctx.userId,
        reason: body.reason,
      },
    });
    return c;
  });
  return NextResponse.json({ correction }, { status: 201 });
}
