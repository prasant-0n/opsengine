import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { describeRules, validateWorkflowRules, type WorkflowRules } from "@/features/approvals/lib/approvals";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_WORKFLOW_READ, {
    tenantId: ctx.tenantId,
    resourceType: "workflow_definition",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workflow = await prisma.workflowDefinition.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.workflowVersion.findMany({
    where: { tenantId: ctx.tenantId, definitionId: id },
    orderBy: { versionNumber: "desc" },
  });
  return NextResponse.json({
    workflow,
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      status: v.status,
      rules: v.rules,
      summary: describeRules(v.rules as unknown as WorkflowRules),
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      createdAt: v.createdAt,
    })),
  });
}

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
  const rules = validateWorkflowRules(body.rules);
  if (!rules.ok) return NextResponse.json({ error: "Invalid rules", code: "INVALID_RULES", details: rules.errors }, { status: 400 });

  const latest = await prisma.workflowVersion.findFirst({
    where: { tenantId: ctx.tenantId, definitionId: id },
    orderBy: { versionNumber: "desc" },
  });
  const nextNumber = (latest?.versionNumber ?? 0) + 1;

  const version = await prisma.workflowVersion.create({
    data: {
      tenantId: ctx.tenantId,
      definitionId: id,
      versionNumber: nextNumber,
      status: "draft",
      rules: rules.value as any,
      createdBy: ctx.userId,
    },
  });
  return NextResponse.json({ version }, { status: 201 });
}
