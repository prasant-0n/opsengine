import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { validatePushEndpoint } from "@/features/pwa";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Invalid session context" }, { status: 403 });

  const authz = authorize(ctx, PERMISSIONS.NOTIFICATION_PUSH_SUBSCRIBE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "push_subscription",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      isActive: true,
    },
    select: {
      id: true,
      endpoint: true,
      userAgent: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: subscriptions });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Invalid session context" }, { status: 403 });

  const authz = authorize(ctx, PERMISSIONS.NOTIFICATION_PUSH_SUBSCRIBE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "push_subscription",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { endpoint, keys, userAgent } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Valid endpoint is required" }, { status: 400 });
    }

    if (!keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json(
        { error: "Push encryption keys (p256dh, auth) are required" },
        { status: 400 }
      );
    }

    const validation = validatePushEndpoint(endpoint);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        endpoint,
        p256dh: String(keys.p256dh),
        auth: String(keys.auth),
        userAgent: userAgent ? String(userAgent) : req.headers.get("user-agent") || null,
        isActive: true,
      },
      update: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        p256dh: String(keys.p256dh),
        auth: String(keys.auth),
        userAgent: userAgent ? String(userAgent) : req.headers.get("user-agent") || null,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        message: "Push subscription registered successfully",
        data: {
          id: subscription.id,
          endpoint: subscription.endpoint,
          isActive: subscription.isActive,
          createdAt: subscription.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to register subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Invalid session context" }, { status: 403 });

  const authz = authorize(ctx, PERMISSIONS.NOTIFICATION_PUSH_SUBSCRIBE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "push_subscription",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
    }

    // Verify endpoint belongs to calling user and tenant
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (!existing || existing.tenantId !== ctx.tenantId || existing.userId !== ctx.userId) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    await prisma.pushSubscription.update({
      where: { endpoint },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Push subscription deactivated" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unsubscribe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
