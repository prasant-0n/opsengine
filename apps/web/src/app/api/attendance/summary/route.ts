import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!ctx.employeeId) {
    return NextResponse.json({ error: "No employee profile found" }, { status: 400 });
  }

  const authz = authorize(ctx, PERMISSIONS.TIME_ATTENDANCE_READ_SELF, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const today = todayStr();
  const workDate = new Date(today + "T00:00:00Z");

  // Today's attendance record
  const todayRecord = await prisma.attendanceDay.findFirst({
    where: {
      tenantId: ctx.tenantId,
      employeeId: ctx.employeeId,
      workDate,
    },
  });

  // Check if on approved leave today
  const onLeaveToday = await prisma.leaveRequest.findFirst({
    where: {
      tenantId: ctx.tenantId,
      employeeId: ctx.employeeId,
      status: "approved",
      startDate: { lte: workDate },
      endDate: { gte: workDate },
    },
  });

  const status = onLeaveToday
    ? "leave"
    : todayRecord?.status ?? "not_checked_in";

  // Past 30 days history
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const history = await prisma.attendanceDay.findMany({
    where: {
      tenantId: ctx.tenantId,
      employeeId: ctx.employeeId,
      workDate: { gte: thirtyDaysAgo },
    },
    orderBy: { workDate: "desc" },
    take: 30,
  });

  // Recent corrections
  const dayIds = history.map((h) => h.id);
  const corrections = await prisma.attendanceCorrection.findMany({
    where: {
      tenantId: ctx.tenantId,
      attendanceDayId: { in: dayIds },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    status,
    todayRecord: todayRecord ?? null,
    onLeaveToday: Boolean(onLeaveToday),
    history,
    corrections,
    serverTime: new Date().toISOString(),
  });
}
