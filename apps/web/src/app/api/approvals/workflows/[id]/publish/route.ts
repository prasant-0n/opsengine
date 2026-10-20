import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { validateWorkflowRules } from "@/features/approvals/lib/approvals";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_WORKFLOW_MANAGE, {
    tenantId: ctx.tenantId,
    resourceType: "workflow_definition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workflow = await prisma.workflowDefinition.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const versionNumber = Number(body.versionNumber);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ error: "versionNumber is required" }, { status: 400 });
  }

  const version = await prisma.workflowVersion.findFirst({
    where: { tenantId: ctx.tenantId, definitionId: id, versionNumber },
  });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  if (version.status === "published") {
    return NextResponse.json({ error: "Version already published" }, { status: 409 });
  }
  if (version.status === "retired") {
    return NextResponse.json({ error: "Cannot publish a retired version" }, { status: 409 });
  }

  // Re-validate at publish time (defense in depth — rules are data, never code).
  const rules = validateWorkflowRules(version.rules);
  if (!rules.ok) return NextResponse.json({ error: "Invalid rules", code: "INVALID_RULES", details: rules.errors }, { status: 400 });

  const now = new Date();
  const published = await prisma.$transaction(async (tx) => {
    await tx.workflowVersion.updateMany({
      where: { tenantId: ctx.tenantId, definitionId: id, status: "published" },
      data: { status: "retired", effectiveTo: now },
    });
    const v = await tx.workflowVersion.update({
      where: { id: version.id },
      data: { status: "published", effectiveFrom: now, effectiveTo: null },
    });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "workflow_definition",
        entityId: id,
        fromStatus: version.status,
        toStatus: "published",
        actorId: ctx.userId,
        reason: `Published version ${versionNumber}`,
      },
    });
    return v;
  });

  return NextResponse.json({ workflow, version: { versionNumber: published.versionNumber, status: published.status } });
}
