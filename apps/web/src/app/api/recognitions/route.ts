import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.RECOGNITION_READ, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "recognition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const recipientId = searchParams.get("recipientId");

  const whereClause: any = { tenantId: ctx.tenantId };
  if (recipientId) {
    whereClause.recipientId = recipientId;
  }

  const recognitions = await prisma.employeeRecognition.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Calculate current user's earned points
  const userRecognitions = await prisma.employeeRecognition.findMany({
    where: { tenantId: ctx.tenantId, recipientId: ctx.employeeId },
    select: { pointsAwarded: true },
  });
  const myTotalPoints = userRecognitions.reduce((acc, r) => acc + (r.pointsAwarded || 0), 0);

  return NextResponse.json({
    data: recognitions,
    myTotalPoints,
  });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.RECOGNITION_GIVE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "recognition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { recipientId, badgeId, message, pointsAwarded } = body;

    if (!recipientId || !badgeId || !message) {
      return NextResponse.json(
        { error: "recipientId, badgeId, and message are required." },
        { status: 400 }
      );
    }

    // Segregation of Duties: Cannot give kudos/points to self
    if (recipientId === ctx.employeeId) {
      return NextResponse.json(
        { error: "Segregation of Duties: you cannot award recognition points to yourself." },
        { status: 403 }
      );
    }

    // Verify recipient employee exists in same tenant
    const recipient = await prisma.employee.findFirst({
      where: { id: recipientId, tenantId: ctx.tenantId },
    });
    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient employee not found in this tenant." },
        { status: 404 }
      );
    }

    // Verify badge exists in tenant
    const badge = await prisma.recognitionBadge.findFirst({
      where: { id: badgeId, tenantId: ctx.tenantId, isActive: true },
    });
    if (!badge) {
      return NextResponse.json(
        { error: "Active recognition badge not found in this tenant." },
        { status: 404 }
      );
    }

    const points = pointsAwarded !== undefined ? Number(pointsAwarded) : badge.pointsValue;

    const recognition = await prisma.employeeRecognition.create({
      data: {
        tenantId: ctx.tenantId,
        senderId: ctx.employeeId,
        recipientId,
        badgeId,
        message: String(message).trim(),
        pointsAwarded: points,
      },
    });

    return NextResponse.json(
      {
        message: `Recognition awarded successfully to ${recipient.displayName}!`,
        data: recognition,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit recognition" },
      { status: 500 }
    );
  }
}
