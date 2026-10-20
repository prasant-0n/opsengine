import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isValidMilestoneStatus } from "@/features/projects/lib/projects";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.PROJECT_UPDATE, {
    tenantId: ctx.tenantId,
    resourceType: "project",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const milestone = await prisma.projectMilestone.findFirst({ where: { id: mid, projectId: id, tenantId: ctx.tenantId } });
  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isValidMilestoneStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }

  const updated = await prisma.projectMilestone.update({ where: { id: mid }, data });
  return NextResponse.json({ milestone: updated });
}
