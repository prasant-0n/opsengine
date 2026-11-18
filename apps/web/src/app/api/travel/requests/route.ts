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

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const employeeId = searchParams.get("employeeId");

  // Determine read permission: self vs team/tenant
  const canReadTeam = authorize(ctx, PERMISSIONS.TRAVEL_REQUEST_READ_TEAM, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "travel_request",
  }).allowed;

  const canReadSelf = authorize(ctx, PERMISSIONS.TRAVEL_REQUEST_READ_SELF, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "travel_request",
  }).allowed;

  if (!canReadTeam && !canReadSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const whereClause: any = { tenantId: ctx.tenantId };

  if (status) {
    whereClause.status = status;
  }

  // If user can only read self, enforce employeeId filter
  if (!canReadTeam) {
    whereClause.employeeId = ctx.employeeId;
  } else if (employeeId) {
    whereClause.employeeId = employeeId;
  }

  const requests = await prisma.travelRequest.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: requests.map(serializeTravelRequest) });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.TRAVEL_REQUEST_CREATE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "travel_request",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      title,
      purpose,
      destinationCity,
      destinationCountry,
      startDate,
      endDate,
      estimatedTotalCents,
      currency,
      projectId,
      clientAccountId,
      items,
    } = body;

    if (!title || !destinationCity || !destinationCountry || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields: title, destinationCity, destinationCountry, startDate, endDate" },
        { status: 400 }
      );
    }

    let tripDays: number;
    try {
      tripDays = calculateTripDurationDays(startDate, endDate);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Invalid dates" }, { status: 400 });
    }

    const estCents = BigInt(estimatedTotalCents || 0);
    const tier = getDestinationTier(destinationCity, destinationCountry);
    const compliance = evaluatePerDiemCompliance(estCents, tripDays, tier);

    const travelRequest = await prisma.travelRequest.create({
      data: {
        tenantId: ctx.tenantId,
        employeeId: ctx.employeeId,
        title: title.trim(),
        purpose: purpose || "client_engagement",
        destinationCity: destinationCity.trim(),
        destinationCountry: destinationCountry.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        estimatedTotalCents: estCents,
        currency: currency || "USD",
        advanceAmountCents: 0n,
        status: "submitted",
        projectId: projectId || null,
        clientAccountId: clientAccountId || null,
      },
    });

    // Optionally create itinerary items if provided
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.type && item.carrierOrVendor) {
          await prisma.travelItineraryItem.create({
            data: {
              tenantId: ctx.tenantId,
              travelRequestId: travelRequest.id,
              type: item.type,
              carrierOrVendor: item.carrierOrVendor,
              bookingReference: item.bookingReference || null,
              confirmationCode: item.confirmationCode || null,
              departureAt: item.departureAt ? new Date(item.departureAt) : null,
              arrivalAt: item.arrivalAt ? new Date(item.arrivalAt) : null,
              costCents: BigInt(item.costCents || 0),
              notes: item.notes || null,
            },
          });
        }
      }
    }

    const createdWithItems = await prisma.travelRequest.findUnique({
      where: { id: travelRequest.id },
    });

    return NextResponse.json(
      {
        data: serializeTravelRequest(createdWithItems),
        compliance,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
