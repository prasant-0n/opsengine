import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.PROJECT_APPROVE, {
    tenantId: ctx.tenantId,
    resourceType: "project",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const project = await prisma.project.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.status !== "pending_approval") {
    return NextResponse.json({ error: `Cannot approve from status '${project.status}'` }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.project.update({ where: { id }, data: { status: "approved" } });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "project",
        entityId: id,
        fromStatus: project.status,
        toStatus: "approved",
        actorId: ctx.userId,
        reason: "Approved via governed action",
      },
    });
    return u;
  });
  return NextResponse.json({ project: { ...updated, budgetCents: updated.budgetCents !== null ? String(updated.budgetCents) : null } });
}
