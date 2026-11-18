import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { serializeTravelRequest } from "@/features/travel/lib/travel-engine";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
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

  // Segregation of Duties (SoD): Requester cannot approve their own travel request
  if (travelRequest.employeeId === ctx.employeeId) {
    return NextResponse.json(
      { error: "Self-approval is forbidden by Segregation of Duties (SoD) policy" },
      { status: 403 }
    );
  }

  const authz = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_MANAGER, {
    tenantId: ctx.tenantId,
    owningEmployeeId: travelRequest.employeeId,
    resourceType: "travel_request",
  });
  if (!authz.allowed) {
    return NextResponse.json({ error: "Unauthorized: Manager approval required" }, { status: 403 });
  }

  if (travelRequest.status !== "submitted") {
    return NextResponse.json(
      { error: `Cannot approve request with current status '${travelRequest.status}'` },
      { status: 400 }
    );
  }

  const updated = await prisma.travelRequest.update({
    where: { id: travelRequest.id },
    data: {
      status: "manager_approved",
      managerApproverId: ctx.employeeId,
      managerApprovedAt: new Date(),
    },
  });

  return NextResponse.json({ data: serializeTravelRequest(updated) });
}
