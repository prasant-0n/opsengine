import { NextRequest, NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/auth/portal-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  const { id } = await params;
  const { tenantId, accountId, userId, contactName, isStaff } = auth.ctx;

  const ticket = await prisma.ticket.findFirst({
    where: { id, tenantId },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Account Isolation Check (Anti-IDOR)
  let isAllowed = ticket.accountId === accountId;
  if (!isAllowed && ticket.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: ticket.projectId, tenantId, accountId },
    });
    if (proj) isAllowed = true;
  }

  if (!isAllowed) {
    return NextResponse.json(
      { error: "Forbidden: You do not have permission to comment on this ticket" },
      { status: 403 }
    );
  }

  try {
    const bodyJson = await req.json();
    const commentText = (bodyJson.body ?? "").trim();
    if (!commentText) {
      return NextResponse.json(
        { error: "Comment text cannot be empty" },
        { status: 400 }
      );
    }

    // Anti-leakage guardrail: Clients CANNOT create internal notes
    const isInternal = isStaff ? Boolean(bodyJson.isInternal) : false;

    const comment = await prisma.ticketComment.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        authorId: userId,
        authorType: isStaff ? "staff" : "client",
        authorName: contactName,
        body: commentText,
        isInternal,
      },
    });

    // If ticket was closed or resolved and customer replied, reopen it
    if (!isStaff && (ticket.status === "closed" || ticket.status === "resolved")) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "in_progress" },
      });
    }

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to post comment" },
      { status: 400 }
    );
  }
}
