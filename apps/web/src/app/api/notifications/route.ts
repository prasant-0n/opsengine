import { NextRequest, NextResponse } from "next/server";
import { globalNotificationHub, AppNotification } from "@/lib/notifications";
import { randomUUID } from "node:crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = req.headers.get("x-tenant-id") || searchParams.get("tenantId") || "tenant-default";
  const userId = searchParams.get("userId") || undefined;
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const result = globalNotificationHub.getNotifications({
    tenantId,
    userId,
    unreadOnly,
    limit,
  });

  return NextResponse.json({
    ...result,
    activeConnections: globalNotificationHub.getActiveConnectionCount(tenantId),
    timestamp: new Date().toISOString(),
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId || searchParams.get("tenantId") || "tenant-default";
    const notificationId = body.notificationId;
    const userId = body.userId;

    const result = globalNotificationHub.markAsRead(tenantId, notificationId, userId);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to update notification status", details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get("x-tenant-id") || body.tenantId || "tenant-default";

    if (!body.title || !body.message) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 }
      );
    }

    const notification: AppNotification = {
      id: randomUUID(),
      tenantId,
      userId: body.userId,
      title: body.title,
      message: body.message,
      category: body.category || "SYSTEM",
      severity: body.severity || "INFO",
      link: body.link,
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: body.metadata,
    };

    const deliveredCount = globalNotificationHub.dispatch(notification);

    return NextResponse.json({
      success: true,
      notification,
      deliveredToActiveStreams: deliveredCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to dispatch notification", details: err?.message },
      { status: 500 }
    );
  }
}
