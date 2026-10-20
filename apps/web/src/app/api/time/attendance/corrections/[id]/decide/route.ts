import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Decide a correction (governed). Approving applies the proposed punches;
// rejecting restores the day status to its prior derived state.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_ATTENDANCE_CORRECT, {
    tenantId: ctx.tenantId,
    resourceType: "attendance_correction",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 });
  }

  const correction = await prisma.attendanceCorrection.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!correction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (correction.status !== "pending") return NextResponse.json({ error: `Already ${correction.status}` }, { status: 409 });

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.attendanceCorrection.update({
      where: { id },
      data: { status: decision, decidedBy: ctx.userId, decidedAt: new Date(), decisionReason: body.reason ?? null },
    });
    const day = await tx.attendanceDay.findFirst({ where: { id: correction.attendanceDayId } });
    if (day) {
      if (decision === "approved") {
        const checkIn = correction.proposedCheckIn ?? day.checkInAt;
        const checkOut = correction.proposedCheckOut ?? day.checkOutAt;
        await tx.attendanceDay.update({
          where: { id: day.id },
          data: { checkInAt: checkIn, checkOutAt: checkOut, status: checkOut ? "checked_out" : "checked_in" },
        });
      } else {
        // Restore prior status (punches were never mutated on request).
        await tx.attendanceDay.update({
          where: { id: day.id },
          data: { status: day.checkOutAt ? "checked_out" : day.checkInAt ? "checked_in" : "not_checked_in" },
        });
      }
    }
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "attendance_correction",
        entityId: id,
        fromStatus: correction.status,
        toStatus: decision,
        actorId: ctx.userId,
        reason: body.reason ?? null,
      },
    });
    return c;
  });
  return NextResponse.json({ correction: updated });
}
