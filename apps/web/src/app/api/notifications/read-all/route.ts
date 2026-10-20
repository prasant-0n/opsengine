import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { tenantId: ctx.tenantId, recipientUserId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
