import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { listLeaveTypes } from "@/features/leave/lib/leave-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const types = await listLeaveTypes(ctx.tenantId);
  return NextResponse.json({ types });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.LEAVE_TYPE_MANAGE, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { code, name, description, annualAllowance = 0, isPaid = true, requiresApproval = true, allowHalfDay = true } = body;
  if (!code || !name) {
    return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
  }

  try {
    const created = await prisma.leaveType.create({
      data: {
        tenantId: ctx.tenantId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() ?? null,
        annualAllowance: Number(annualAllowance) || 0,
        isPaid: Boolean(isPaid),
        requiresApproval: Boolean(requiresApproval),
        allowHalfDay: Boolean(allowHalfDay),
        active: true,
      },
    });
    return NextResponse.json({ leaveType: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create leave type" }, { status: 400 });
  }
}
