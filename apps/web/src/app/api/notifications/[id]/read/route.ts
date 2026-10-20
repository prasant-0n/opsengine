import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const notif = await prisma.notification.findFirst({
    where: { id, tenantId: ctx.tenantId, recipientUserId: ctx.userId },
  });
  if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.notification.update({
    where: { id: notif.id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ notification: updated });
}
