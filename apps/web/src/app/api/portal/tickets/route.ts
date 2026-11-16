import { NextRequest, NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/auth/portal-auth";
import { prisma } from "@/lib/prisma";
import {
  calculateSlaTarget,
  getSlaStatus,
  isValidPortalTicketPriority,
  isValidPortalTicketType,
} from "@/features/portal/lib/portal-sla";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  const { tenantId, accountId } = auth.ctx;

  // Find projects belonging to this account so tickets linked to projects are also included
  const accountProjects = await prisma.project.findMany({
    where: { tenantId, accountId },
    select: { id: true },
  });
  const projectIds = accountProjects.map((p) => p.id);

  // Tickets matching accountId OR projectId of this account
  const whereCondition: any = {
    tenantId,
    OR: [
      { accountId },
      ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
    ],
  };

  const tickets = await prisma.ticket.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
  });

  const enriched = tickets.map((t) => {
    const sla = getSlaStatus(t.slaDueAt, t.status === "closed" || t.status === "resolved" ? t.updatedAt : null);
    return {
      ...t,
      slaStatus: sla,
    };
  });

  return NextResponse.json({
    data: enriched,
    total: enriched.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  const { tenantId, accountId, userId, contactName } = auth.ctx;

  try {
    const body = await req.json();
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const type = (body.type ?? "support").trim();
    const priority = (body.priority ?? "medium").trim();
    const projectId = body.projectId ? String(body.projectId).trim() : null;

    if (!title || title.length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters long" },
        { status: 400 }
      );
    }

    if (!isValidPortalTicketType(type) && type !== "support") {
      return NextResponse.json(
        { error: "Invalid ticket type. Allowed: bug, service_request, question, incident, support" },
        { status: 400 }
      );
    }

    if (!isValidPortalTicketPriority(priority)) {
      return NextResponse.json(
        { error: "Invalid ticket priority. Allowed: low, medium, high, urgent" },
        { status: 400 }
      );
    }

    // Verify projectId if specified belongs to this account & tenant
    if (projectId) {
      const proj = await prisma.project.findFirst({
        where: { id: projectId, tenantId, accountId },
      });
      if (!proj) {
        return NextResponse.json(
          { error: "Invalid project for this account" },
          { status: 403 }
        );
      }
    }

    const slaDueAt = calculateSlaTarget(priority);

    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        accountId,
        projectId,
        title,
        description: description || null,
        type,
        priority,
        status: "open",
        reporterId: userId,
        slaDueAt,
      },
    });

    // If description was provided, also create initial public comment
    if (description) {
      await prisma.ticketComment.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          authorId: userId,
          authorType: auth.ctx.isStaff ? "staff" : "client",
          authorName: contactName,
          body: description,
          isInternal: false,
        },
      });
    }

    const slaStatus = getSlaStatus(slaDueAt);

    return NextResponse.json(
      {
        data: {
          ...ticket,
          slaStatus,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create ticket" },
      { status: 400 }
    );
  }
}
