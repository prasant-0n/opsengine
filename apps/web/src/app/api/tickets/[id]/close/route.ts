import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.TICKET_CLOSE, {
    tenantId: ctx.tenantId,
    resourceType: "ticket",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // fall through to missing-reason check
  }
  if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "Missing reason" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.status === "closed") {
    return NextResponse.json({ error: "Ticket already closed" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id }, data: { status: "closed", closedReason: body.reason } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "ticket",
        entityId: id,
        fromStatus: ticket.status,
        toStatus: "closed",
        actorId: ctx.userId,
        reason: body.reason,
      },
    });
    return u;
  });
  return NextResponse.json({ ticket: updated });
}
