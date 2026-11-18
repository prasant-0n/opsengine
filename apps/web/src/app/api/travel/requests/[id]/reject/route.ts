import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { serializeTravelRequest } from "@/features/travel/lib/travel-engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const { id } = await params;

  const travelRequest = await prisma.travelRequest.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!travelRequest) {
    return NextResponse.json({ error: "Travel request not found" }, { status: 404 });
  }

  // Segregation of Duties (SoD): Requester cannot reject/approve their own travel request
  if (travelRequest.employeeId === ctx.employeeId) {
    return NextResponse.json(
      { error: "Self-action is forbidden by Segregation of Duties (SoD) policy" },
      { status: 403 }
    );
  }

  const canManagerApprove = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_MANAGER, {
    tenantId: ctx.tenantId,
    owningEmployeeId: travelRequest.employeeId,
    resourceType: "travel_request",
  }).allowed;

  const canFinanceApprove = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_FINANCE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: travelRequest.employeeId,
    resourceType: "travel_request",
  }).allowed;

  if (!canManagerApprove && !canFinanceApprove) {
    return NextResponse.json({ error: "Unauthorized: Approval permissions required to reject" }, { status: 403 });
  }

  let rejectionReason: string | undefined;
  try {
    const body = await req.json();
    rejectionReason = body.rejectionReason;
  } catch {
    // Body parse
  }

  if (!rejectionReason || typeof rejectionReason !== "string" || !rejectionReason.trim()) {
    return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
  }

  const updated = await prisma.travelRequest.update({
    where: { id: travelRequest.id },
    data: {
      status: "rejected",
      rejectionReason: rejectionReason.trim(),
    },
  });

  return NextResponse.json({ data: serializeTravelRequest(updated) });
}
