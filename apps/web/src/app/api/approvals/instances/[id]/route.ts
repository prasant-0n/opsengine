import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { isInstanceOverdue } from "@/features/approvals/lib/approvals";

export const dynamic = "force-dynamic";

function serialize(i: any) {
  return {
    ...i,
    amountCents: i.amountCents !== null && i.amountCents !== undefined ? String(i.amountCents) : null,
    amountThresholdCents:
      i.amountThresholdCents !== null && i.amountThresholdCents !== undefined ? String(i.amountThresholdCents) : null,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_READ, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const instance = await prisma.approvalInstance.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [steps, decisions, version] = await Promise.all([
    prisma.approvalStep.findMany({ where: { tenantId: ctx.tenantId, instanceId: id }, orderBy: { stepNumber: "asc" } }),
    prisma.approvalDecision.findMany({ where: { tenantId: ctx.tenantId, instanceId: id }, orderBy: { decidedAt: "asc" } }),
    prisma.workflowVersion.findFirst({ where: { id: instance.workflowVersionId, tenantId: ctx.tenantId } }),
  ]);

  return NextResponse.json({
    instance: { ...serialize(instance), overdue: isInstanceOverdue(instance.dueAt, instance.status, new Date()) },
    steps: steps.map(serialize),
    decisions: decisions.map((d) => ({ ...d, isSodOverride: d.isSodOverride })),
    workflowVersion: version ? { versionNumber: version.versionNumber, status: version.status } : null,
  });
}
