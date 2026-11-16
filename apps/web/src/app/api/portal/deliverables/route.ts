import { NextRequest, NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/auth/portal-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  const { tenantId, accountId } = auth.ctx;

  const deliverables = await prisma.clientDeliverable.findMany({
    where: { tenantId, accountId },
    orderBy: { submittedAt: "desc" },
  });

  // Enrich with project details and latest sign-offs
  const projectIds = Array.from(new Set(deliverables.map((d) => d.projectId)));
  const deliverableIds = deliverables.map((d) => d.id);

  const [projects, signOffs] = await Promise.all([
    projectIds.length
      ? prisma.project.findMany({
          where: { id: { in: projectIds }, tenantId },
          select: { id: true, name: true, code: true },
        })
      : [],
    deliverableIds.length
      ? prisma.clientDeliverableSignOff.findMany({
          where: { deliverableId: { in: deliverableIds }, tenantId },
          orderBy: { signedAt: "desc" },
        })
      : [],
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const signOffMap = new Map<string, typeof signOffs>();
  for (const s of signOffs) {
    const list = signOffMap.get(s.deliverableId) ?? [];
    list.push(s);
    signOffMap.set(s.deliverableId, list);
  }

  const enriched = deliverables.map((d) => ({
    ...d,
    project: projectMap.get(d.projectId) || null,
    signOffs: signOffMap.get(d.id) || [],
  }));

  return NextResponse.json({
    data: enriched,
    total: enriched.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  // Only staff can submit deliverables for client review
  if (!auth.ctx.isStaff) {
    return NextResponse.json(
      { error: "Forbidden: Only delivery staff can register client deliverables" },
      { status: 403 }
    );
  }

  const { tenantId, accountId } = auth.ctx;

  try {
    const body = await req.json();
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const deliverableUrl = (body.deliverableUrl ?? "").trim();
    const projectId = (body.projectId ?? "").trim();
    const milestoneId = body.milestoneId ? String(body.milestoneId).trim() : null;

    if (!title || title.length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify project belongs to account
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId, accountId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or does not belong to this account" },
        { status: 404 }
      );
    }

    const deliverable = await prisma.clientDeliverable.create({
      data: {
        tenantId,
        projectId,
        milestoneId,
        accountId,
        title,
        description: description || null,
        deliverableUrl: deliverableUrl || null,
        status: "pending_review",
      },
    });

    return NextResponse.json({ data: deliverable }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create deliverable" },
      { status: 400 }
    );
  }
}
