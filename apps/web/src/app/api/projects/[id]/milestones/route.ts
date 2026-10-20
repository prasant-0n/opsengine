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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.name || typeof body.name !== "string") return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const project = await prisma.project.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { id: true, status: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.status === "completed" || project.status === "cancelled") {
    return NextResponse.json({ error: "Cannot add milestones to completed/cancelled project" }, { status: 409 });
  }

  const milestone = await prisma.projectMilestone.create({
    data: {
      tenantId: ctx.tenantId,
      projectId: id,
      name: body.name,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: "pending",
    },
  });
  return NextResponse.json({ milestone }, { status: 201 });
}
