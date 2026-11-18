import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  calculateTripDurationDays,
  evaluatePerDiemCompliance,
  getDestinationTier,
  serializeTravelRequest,
} from "@/features/travel/lib/travel-engine";

export const dynamic = "force-dynamic";

export async function GET(
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
    where: {
      id,
      tenantId: ctx.tenantId,
    },
  });

  if (!travelRequest) {
    return NextResponse.json({ error: "Travel request not found" }, { status: 404 });
  }

  // Authorization check
  const isOwner = travelRequest.employeeId === ctx.employeeId;
  const canReadTeam = authorize(ctx, PERMISSIONS.TRAVEL_REQUEST_READ_TEAM, {
    tenantId: ctx.tenantId,
    owningEmployeeId: travelRequest.employeeId,
    resourceType: "travel_request",
  }).allowed;

  const canReadSelf = authorize(ctx, PERMISSIONS.TRAVEL_REQUEST_READ_SELF, {
    tenantId: ctx.tenantId,
    owningEmployeeId: travelRequest.employeeId,
    resourceType: "travel_request",
  }).allowed;

  if (!canReadTeam && (!isOwner || !canReadSelf)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.travelItineraryItem.findMany({
    where: {
      travelRequestId: travelRequest.id,
      tenantId: ctx.tenantId,
    },
    orderBy: { createdAt: "asc" },
  });

  const employee = await prisma.employee.findUnique({
    where: { id: travelRequest.employeeId },
    select: { id: true, displayName: true, jobTitle: true, department: true },
  });

  let compliance = null;
  try {
    const days = calculateTripDurationDays(travelRequest.startDate, travelRequest.endDate);
    const tier = getDestinationTier(travelRequest.destinationCity, travelRequest.destinationCountry);
    compliance = evaluatePerDiemCompliance(travelRequest.estimatedTotalCents, days, tier);
  } catch {
    // Graceful fallback if dates invalid
  }

  const serialized = serializeTravelRequest({
    ...travelRequest,
    itineraryItems: items,
    employee,
  });

  return NextResponse.json({
    data: serialized,
    compliance,
  });
}
