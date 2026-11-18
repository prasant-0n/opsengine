import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { serializeTravelRequest } from "@/features/travel/lib/travel-engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const { id } = await params;

  const travelRequest = await prisma.travelRequest.findFirst({
    where: {
      id,
      tenantId: ctx.tenantId,
    },
  });

  if (!travelRequest) {
    return NextResponse.json({ error: "Travel request not found" }, { status: 404 });
  }

  // Segregation of Duties (SoD): Requester cannot approve their own travel request
  if (travelRequest.employeeId === ctx.employeeId) {
    return NextResponse.json(
      { error: "Self-approval is forbidden by Segregation of Duties (SoD) policy" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { action, advanceAmountCents, rejectionReason } = body;

    if (!action || !["manager_approve", "finance_approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be manager_approve, finance_approve, or reject" },
        { status: 400 }
      );
    }

    if (action === "manager_approve") {
      const authz = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_MANAGER, {
        tenantId: ctx.tenantId,
        owningEmployeeId: travelRequest.employeeId,
        resourceType: "travel_request",
      });
      if (!authz.allowed) {
        return NextResponse.json({ error: "Unauthorized: Manager approval required" }, { status: 403 });
      }

      if (travelRequest.status !== "submitted") {
        return NextResponse.json(
          { error: `Cannot approve request with current status '${travelRequest.status}'` },
          { status: 400 }
        );
      }

      const updated = await prisma.travelRequest.update({
        where: { id: travelRequest.id },
        data: {
          status: "manager_approved",
          managerApproverId: ctx.employeeId,
          managerApprovedAt: new Date(),
        },
      });

      return NextResponse.json({ data: serializeTravelRequest(updated) });
    }

    if (action === "finance_approve") {
      const authz = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_FINANCE, {
        tenantId: ctx.tenantId,
        owningEmployeeId: travelRequest.employeeId,
        resourceType: "travel_request",
      });
      if (!authz.allowed) {
        return NextResponse.json({ error: "Unauthorized: Finance approval required" }, { status: 403 });
      }

      if (travelRequest.status !== "submitted" && travelRequest.status !== "manager_approved") {
        return NextResponse.json(
          { error: `Cannot finance-approve request with current status '${travelRequest.status}'` },
          { status: 400 }
        );
      }

      const advanceCents = advanceAmountCents !== undefined ? BigInt(advanceAmountCents) : travelRequest.advanceAmountCents;
      if (advanceCents > 0n) {
        const canDisburse = authorize(ctx, PERMISSIONS.TRAVEL_DISBURSE_ADVANCE, {
          tenantId: ctx.tenantId,
          owningEmployeeId: travelRequest.employeeId,
          resourceType: "travel_request",
        }).allowed;
        if (!canDisburse) {
          return NextResponse.json(
            { error: "Unauthorized: Travel advance disbursement permission required" },
            { status: 403 }
          );
        }
      }

      const updated = await prisma.travelRequest.update({
        where: { id: travelRequest.id },
        data: {
          status: "finance_approved",
          financeApproverId: ctx.employeeId,
          financeApprovedAt: new Date(),
          advanceAmountCents: advanceCents,
        },
      });

      return NextResponse.json({ data: serializeTravelRequest(updated) });
    }

    if (action === "reject") {
      const canManagerApprove = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_MANAGER, {
        tenantId: ctx.tenantId,
        owningEmployeeId: travelRequest.employeeId,
        resourceType: "travel_request",
      }).allowed;

      const canFinanceApprove = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_FINANCE, {
        tenantId: ctx.tenantId,
        owningEmployeeId: travelRequest.employeeId,
        resourceType: "travel_request",
      }).allowed;

      if (!canManagerApprove && !canFinanceApprove) {
        return NextResponse.json({ error: "Unauthorized: Approval permissions required to reject" }, { status: 403 });
      }

      if (!rejectionReason || typeof rejectionReason !== "string" || !rejectionReason.trim()) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
      }

      const updated = await prisma.travelRequest.update({
        where: { id: travelRequest.id },
        data: {
          status: "rejected",
          rejectionReason: rejectionReason.trim(),
        },
      });

      return NextResponse.json({ data: serializeTravelRequest(updated) });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
