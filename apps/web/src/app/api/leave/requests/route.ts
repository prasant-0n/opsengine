import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { applyLeave } from "@/features/leave/lib/leave-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view"); // "team" | "self"
  const status = searchParams.get("status");

  const isTeam = view === "team";
  const requiredPermission = isTeam
    ? PERMISSIONS.LEAVE_REQUEST_READ_TEAM
    : PERMISSIONS.LEAVE_REQUEST_READ_SELF;

  const authz = authorize(ctx, requiredPermission, {
    tenantId: ctx.tenantId,
    owningEmployeeId: isTeam ? undefined : ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (isTeam) {
    const requests = await prisma.leaveRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const empIds = [...new Set(requests.map((r) => r.employeeId))];
    const typeIds = [...new Set(requests.map((r) => r.leaveTypeId))];

    const [employees, types] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: empIds }, tenantId: ctx.tenantId },
        select: { id: true, displayName: true, department: true, jobTitle: true },
      }),
      prisma.leaveType.findMany({
        where: { id: { in: typeIds }, tenantId: ctx.tenantId },
        select: { id: true, name: true, code: true, isPaid: true },
      }),
    ]);

    const empMap = new Map(employees.map((e) => [e.id, e]));
    const typeMap = new Map(types.map((t) => [t.id, t]));

    return NextResponse.json({
      requests: requests.map((r) => ({
        ...r,
        employee: empMap.get(r.employeeId) ?? null,
        leaveType: typeMap.get(r.leaveTypeId) ?? null,
      })),
    });
  }

  // Self view
  if (!ctx.employeeId) {
    return NextResponse.json({ error: "No employee profile found" }, { status: 400 });
  }

  const requests = await prisma.leaveRequest.findMany({
    where: {
      tenantId: ctx.tenantId,
      employeeId: ctx.employeeId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const typeIds = [...new Set(requests.map((r) => r.leaveTypeId))];
  const types = await prisma.leaveType.findMany({
    where: { id: { in: typeIds }, tenantId: ctx.tenantId },
    select: { id: true, name: true, code: true, isPaid: true },
  });
  const typeMap = new Map(types.map((t) => [t.id, t]));

  return NextResponse.json({
    requests: requests.map((r) => ({
      ...r,
      leaveType: typeMap.get(r.leaveTypeId) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!ctx.employeeId) {
    return NextResponse.json({ error: "No employee profile found" }, { status: 400 });
  }

  const authz = authorize(ctx, PERMISSIONS.LEAVE_REQUEST_CREATE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leaveTypeId, startDate, endDate, isHalfDay, reason } = body;
  if (!leaveTypeId || !startDate || !endDate || !reason?.trim()) {
    return NextResponse.json({ error: "Missing required fields (leaveTypeId, startDate, endDate, reason)" }, { status: 400 });
  }

  try {
    const request = await applyLeave({
      tenantId: ctx.tenantId,
      employeeId: ctx.employeeId,
      leaveTypeId,
      startDate,
      endDate,
      isHalfDay: Boolean(isHalfDay),
      reason: reason.trim(),
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to apply for leave" }, { status: 400 });
  }
}
