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

  const authz = authorize(ctx, PERMISSIONS.PROJECT_UPDATE, {
    tenantId: ctx.tenantId,
    resourceType: "project",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // reason optional for cancel
  }
  if (!body.reason || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "Missing reason" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.status === "completed" || project.status === "cancelled") {
    return NextResponse.json({ error: `Cannot cancel from terminal status '${project.status}'` }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.project.update({ where: { id }, data: { status: "cancelled" } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "project",
        entityId: id,
        fromStatus: project.status,
        toStatus: "cancelled",
        actorId: ctx.userId,
        reason: body.reason,
      },
    });
    return u;
  });
  return NextResponse.json({ project: { ...updated, budgetCents: updated.budgetCents !== null ? String(updated.budgetCents) : null } });
}
