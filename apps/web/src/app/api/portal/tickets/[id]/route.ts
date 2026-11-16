import { NextRequest, NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/auth/portal-auth";
import { prisma } from "@/lib/prisma";
import { getSlaStatus, sanitizeTicketComments } from "@/features/portal/lib/portal-sla";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  const { id } = await params;
  const { tenantId, accountId } = auth.ctx;

  const ticket = await prisma.ticket.findFirst({
    where: { id, tenantId },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Authoritative Account Isolation Check (Anti-IDOR)
  let isAllowed = ticket.accountId === accountId;
  if (!isAllowed && ticket.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: ticket.projectId, tenantId, accountId },
    });
    if (proj) isAllowed = true;
  }

  if (!isAllowed) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to view this ticket" },
      { status: 403 }
    );
  }

  // Fetch comments: Anti-leakage guardrail strictly filters out internal notes
  const rawComments = await prisma.ticketComment.findMany({
    where: {
      tenantId,
      ticketId: ticket.id,
      // Anti-leakage: if not staff, never query internal comments
      ...(auth.ctx.isStaff ? {} : { isInternal: false }),
    },
    orderBy: { createdAt: "asc" },
  });

  // Defense-in-depth sanitization for client callers
  const sanitizedComments = auth.ctx.isStaff
    ? rawComments
    : sanitizeTicketComments(rawComments);

  const slaStatus = getSlaStatus(
    ticket.slaDueAt,
    ticket.status === "closed" || ticket.status === "resolved" ? ticket.updatedAt : null
  );

  return NextResponse.json({
    data: {
      ...ticket,
      slaStatus,
      comments: sanitizedComments,
    },
  });
}
