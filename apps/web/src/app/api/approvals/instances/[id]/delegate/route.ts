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
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee profile" }, { status: 403 });

  const authz = authorize(ctx, PERMISSIONS.APPROVAL_DELEGATE, {
    tenantId: ctx.tenantId,
    resourceType: "approval_instance",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const instance = await prisma.approvalInstance.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (instance.status !== "pending") {
    return NextResponse.json({ error: `Instance is '${instance.status}'`, code: "NOT_PENDING" }, { status: 409 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const toEmployeeId = typeof body.toEmployeeId === "string" ? body.toEmployeeId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!toEmployeeId) return NextResponse.json({ error: "toEmployeeId is required" }, { status: 400 });
  const target = await prisma.employee.findFirst({ where: { id: toEmployeeId, tenantId: ctx.tenantId, employmentStatus: "active" } });
  if (!target) return NextResponse.json({ error: "Delegate employee not found" }, { status: 400 });

  const endDateInput = typeof body.endDate === "string" ? body.endDate : "";
  const endDate = endDateInput ? new Date(endDateInput + "T00:00:00Z") : new Date(Date.now() + 7 * 86400_000);
  if (isNaN(endDate.getTime())) return NextResponse.json({ error: "endDate invalid" }, { status: 400 });
  const startDate = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  const step = await prisma.approvalStep.findFirst({
    where: { tenantId: ctx.tenantId, instanceId: id, stepNumber: instance.currentStepNumber },
  });

  await prisma.$transaction(async (tx) => {
    await tx.approvalDelegation.create({
      data: {
        tenantId: ctx.tenantId,
        fromEmployeeId: ctx.employeeId!,
        toEmployeeId,
        scopeType: "SPECIFIC_DEFINITION",
        scopeValue: instance.workflowVersionId,
        startDate,
        endDate,
        reason: reason || "Instance delegation",
        active: true,
        createdBy: ctx.userId,
      },
    });
    await tx.approvalDecision.create({
      data: {
        tenantId: ctx.tenantId,
        instanceId: id,
        stepId: step?.id ?? null,
        approverEmployeeId: ctx.employeeId!,
        onBehalfOfEmployeeId: toEmployeeId,
        decision: "delegate",
        reason: reason || null,
      },
    });
    await tx.stageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: "approval_instance",
        entityId: id,
        fromStatus: instance.status,
        toStatus: instance.status,
        actorId: ctx.userId,
        reason: `Delegated to ${target.displayName}${reason ? `: ${reason}` : ""}`,
      },
    });
  });

  return NextResponse.json({ instance: { ...instance, amountCents: instance.amountCents !== null ? String(instance.amountCents) : null } });
}
