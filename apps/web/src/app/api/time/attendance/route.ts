import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_ATTENDANCE_READ_SELF, {
    tenantId: ctx.tenantId,
    resourceType: "attendance",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") ?? today()).trim();
  const to = (searchParams.get("to") ?? from).trim();

  const days = await prisma.attendanceDay.findMany({
    where: {
      tenantId: ctx.tenantId,
      employeeId: ctx.employeeId,
      workDate: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") },
    },
    orderBy: { workDate: "desc" },
  });
  return NextResponse.json({ days });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TIME_ATTENDANCE_CHECKIN, {
    tenantId: ctx.tenantId,
    resourceType: "attendance",
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
  const action = body.action;
  if (action !== "check_in" && action !== "check_out") {
    return NextResponse.json({ error: "action must be check_in or check_out" }, { status: 400 });
  }

  const workDate = new Date(today() + "T00:00:00Z");
  const now = new Date();
  const employeeId = ctx.employeeId;

  const existing = await prisma.attendanceDay.findFirst({
    where: { tenantId: ctx.tenantId, employeeId, workDate },
  });

  if (action === "check_in") {
    if (existing?.status === "checked_in") {
      return NextResponse.json({ error: "Already checked in (duplicate active check-in)" }, { status: 409 });
    }
    if (existing?.status === "checked_out") {
      return NextResponse.json({ error: "Already checked out for today" }, { status: 409 });
    }
    const day = existing
      ? await prisma.attendanceDay.update({ where: { id: existing.id }, data: { checkInAt: now, status: "checked_in" } })
      : await prisma.attendanceDay.create({
          data: { tenantId: ctx.tenantId, employeeId, workDate, checkInAt: now, status: "checked_in" },
        });
    return NextResponse.json({ day }, { status: existing ? 200 : 201 });
  }

  // check_out
  if (!existing || existing.status !== "checked_in") {
    return NextResponse.json({ error: "Not currently checked in" }, { status: 409 });
  }
  const day = await prisma.attendanceDay.update({
    where: { id: existing.id },
    data: { checkOutAt: now, status: "checked_out" },
  });
  return NextResponse.json({ day });
}
