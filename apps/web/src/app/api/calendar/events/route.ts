import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getCalendarEvents,
  createCalendarEvent,
  getCalendarMetrics,
} from "@/features/calendar/lib/calendar-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CALENDAR_EVENT_READ, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start") || undefined;
  const end = searchParams.get("end") || undefined;
  const eventType = searchParams.get("eventType") || undefined;
  const includeMetrics = searchParams.get("metrics") === "true";

  try {
    const [events, metrics] = await Promise.all([
      getCalendarEvents(ctx.tenantId, { start, end, eventType }),
      includeMetrics ? getCalendarMetrics(ctx.tenantId) : Promise.resolve(null),
    ]);

    return NextResponse.json({ events, metrics });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load events" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.CALENDAR_EVENT_CREATE, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const event = await createCalendarEvent(ctx.tenantId, ctx.userId, body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create event" },
      { status: 400 }
    );
  }
}
