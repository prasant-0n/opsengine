import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { sendWebPushNotification } from "@/features/pwa";

export const dynamic = "force-dynamic";

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
    const body = await req.json().catch(() => ({}));
    const title = body.title || "OpsEngine Test Notification";
    const notificationBody =
      body.body || "Web Push notifications are operating properly on this device!";
    const url = body.url || "/dashboard";

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        isActive: true,
      },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: "No active push subscriptions registered for this user" },
        { status: 404 }
      );
    }

    const results = [];
    for (const sub of subscriptions) {
      const dispatchResult = await sendWebPushNotification(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        {
          title,
          body: notificationBody,
          url,
          tag: "opsengine-test",
        }
      );

      // If gateway indicates endpoint is dead (404/410), deactivate subscription
      if (dispatchResult.statusCode === 404 || dispatchResult.statusCode === 410) {
        await prisma.pushSubscription.update({
          where: { endpoint: sub.endpoint },
          data: { isActive: false },
        });
      }

      results.push({
        endpoint: sub.endpoint,
        success: dispatchResult.success,
        statusCode: dispatchResult.statusCode,
        error: dispatchResult.error,
      });
    }

    return NextResponse.json({
      message: `Dispatched test push to ${subscriptions.length} registered device(s)`,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send test push";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
