import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { serializeItineraryItem } from "@/features/travel/lib/travel-engine";

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
    where: { id, tenantId: ctx.tenantId },
  });

  if (!travelRequest) {
    return NextResponse.json({ error: "Travel request not found" }, { status: 404 });
  }

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
    where: { travelRequestId: id, tenantId: ctx.tenantId },
    orderBy: { departureAt: "asc" },
  });

  return NextResponse.json({ data: items.map(serializeItineraryItem) });
}

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

  // Only the owner, their manager or admin can add itinerary items
  const isOwner = travelRequest.employeeId === ctx.employeeId;
  const canManageTeam = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_MANAGER, {
    tenantId: ctx.tenantId,
    owningEmployeeId: travelRequest.employeeId,
    resourceType: "travel_request",
  }).allowed;

  if (!isOwner && !canManageTeam) {
    return NextResponse.json({ error: "Forbidden: Only traveler or manager can add itinerary" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      type,
      carrierOrVendor,
      bookingReference,
      confirmationCode,
      departureAt,
      arrivalAt,
      costCents,
      notes,
    } = body;

    if (!type || !carrierOrVendor) {
      return NextResponse.json(
        { error: "Missing required fields: type and carrierOrVendor" },
        { status: 400 }
      );
    }

    const item = await prisma.travelItineraryItem.create({
      data: {
        tenantId: ctx.tenantId,
        travelRequestId: id,
        type,
        carrierOrVendor,
        bookingReference: bookingReference || null,
        confirmationCode: confirmationCode || null,
        departureAt: departureAt ? new Date(departureAt) : null,
        arrivalAt: arrivalAt ? new Date(arrivalAt) : null,
        costCents: BigInt(costCents || 0),
        notes: notes || null,
      },
    });

    return NextResponse.json({ data: serializeItineraryItem(item) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
