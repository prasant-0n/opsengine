import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { DELEGATION_SCOPE_TYPES, isKnownSubjectType } from "@/features/approvals/lib/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_DELEGATE, {
    tenantId: ctx.tenantId,
    resourceType: "approval_delegation",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.approvalDelegation.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
  });
  const empIds = Array.from(new Set(rows.flatMap((r) => [r.fromEmployeeId, r.toEmployeeId])));
  const emps = empIds.length
    ? await prisma.employee.findMany({ where: { id: { in: empIds }, tenantId: ctx.tenantId }, select: { id: true, displayName: true } })
    : [];
  const name = new Map(emps.map((e) => [e.id, e.displayName]));
  const now = new Date();
  const delegations = rows.map((r) => ({
    ...r,
    fromName: name.get(r.fromEmployeeId) ?? null,
    toName: name.get(r.toEmployeeId) ?? null,
    inWindow: r.active && r.startDate.getTime() <= now.getTime() && r.endDate.getTime() >= now.getTime(),
  }));
  return NextResponse.json({ delegations });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_DELEGATE, {
    tenantId: ctx.tenantId,
    resourceType: "approval_delegation",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const fromEmployeeId = (typeof body.fromEmployeeId === "string" && body.fromEmployeeId.trim()) || ctx.employeeId;
  const toEmployeeId = typeof body.toEmployeeId === "string" ? body.toEmployeeId.trim() : "";
  const scopeType = typeof body.scopeType === "string" ? body.scopeType.trim() : "ALL";
  const scopeValue = typeof body.scopeValue === "string" ? body.scopeValue.trim() : null;
  const startInput = typeof body.startDate === "string" ? body.startDate : "";
  const endInput = typeof body.endDate === "string" ? body.endDate : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;

  if (!toEmployeeId) return NextResponse.json({ error: "toEmployeeId is required" }, { status: 400 });
  if (!(DELEGATION_SCOPE_TYPES as readonly string[]).includes(scopeType)) {
    return NextResponse.json({ error: "scopeType must be ALL|SUBJECT_TYPE|SPECIFIC_DEFINITION" }, { status: 400 });
  }
  if (scopeType === "SUBJECT_TYPE" && !isKnownSubjectType(scopeValue)) {
    return NextResponse.json({ error: "scopeValue must be a known subjectType" }, { status: 400 });
  }
  if (scopeType !== "ALL" && !scopeValue) return NextResponse.json({ error: "scopeValue is required for scoped delegations" }, { status: 400 });
  if (!startInput || !endInput) return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  const startDate = new Date(startInput + "T00:00:00Z");
  const endDate = new Date(endInput + "T00:00:00Z");
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  if (endDate.getTime() < startDate.getTime()) return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });

  const [from, to] = await Promise.all([
    prisma.employee.findFirst({ where: { id: fromEmployeeId, tenantId: ctx.tenantId } }),
    prisma.employee.findFirst({ where: { id: toEmployeeId, tenantId: ctx.tenantId, employmentStatus: "active" } }),
  ]);
  if (!from) return NextResponse.json({ error: "fromEmployee not found" }, { status: 400 });
  if (!to) return NextResponse.json({ error: "toEmployee not found" }, { status: 400 });
  if (fromEmployeeId === toEmployeeId) return NextResponse.json({ error: "Cannot delegate to yourself" }, { status: 400 });

  const delegation = await prisma.approvalDelegation.create({
    data: {
      tenantId: ctx.tenantId,
      fromEmployeeId,
      toEmployeeId,
      scopeType,
      scopeValue: scopeType === "ALL" ? null : scopeValue,
      startDate,
      endDate,
      reason,
      active: true,
      createdBy: ctx.userId,
    },
  });
  return NextResponse.json({ delegation }, { status: 201 });
}
