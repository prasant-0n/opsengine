import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isKnownSubjectType, validateWorkflowRules } from "@/features/approvals/lib/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_WORKFLOW_READ, {
    tenantId: ctx.tenantId,
    resourceType: "workflow_definition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const definitions = await prisma.workflowDefinition.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "asc" },
  });
  const workflows = await Promise.all(
    definitions.map(async (d) => {
      const latest = await prisma.workflowVersion.findFirst({
        where: { tenantId: ctx.tenantId, definitionId: d.id },
        orderBy: { versionNumber: "desc" },
      });
      return {
        id: d.id,
        name: d.name,
        subjectType: d.subjectType,
        description: d.description,
        active: d.active,
        latestVersion: latest ? { versionNumber: latest.versionNumber, status: latest.status } : null,
      };
    }),
  );
  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_WORKFLOW_MANAGE, {
    tenantId: ctx.tenantId,
    resourceType: "workflow_definition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const subjectType = typeof body.subjectType === "string" ? body.subjectType.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!isKnownSubjectType(subjectType)) {
    return NextResponse.json({ error: `subjectType must be one of project|ticket|daily_plan|attendance_correction|allocation|general` }, { status: 400 });
  }

  const rules = validateWorkflowRules(body.rules);
  if (!rules.ok) return NextResponse.json({ error: "Invalid rules", code: "INVALID_RULES", details: rules.errors }, { status: 400 });

  const existing = await prisma.workflowDefinition.findFirst({ where: { tenantId: ctx.tenantId, name } });
  if (existing) return NextResponse.json({ error: "A workflow with that name already exists" }, { status: 409 });

  const created = await prisma.$transaction(async (tx) => {
    const def = await tx.workflowDefinition.create({
      data: { tenantId: ctx.tenantId, name, subjectType, description, active: true },
    });
    const version = await tx.workflowVersion.create({
      data: {
        tenantId: ctx.tenantId,
        definitionId: def.id,
        versionNumber: 1,
        status: "draft",
        rules: rules.value as any,
        createdBy: ctx.userId,
      },
    });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "workflow_definition",
        entityId: def.id,
        toStatus: "created",
        actorId: ctx.userId,
        reason: "Workflow definition created",
      },
    });
    return { def, version };
  });

  return NextResponse.json(
    { workflow: { ...created.def, latestVersion: { versionNumber: created.version.versionNumber, status: created.version.status } } },
    { status: 201 },
  );
}
