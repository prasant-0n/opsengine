import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { buildExpenseBridgeDraft } from "@/features/travel/lib/travel-engine";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
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
    where: { id, tenantId: ctx.tenantId },
  });

  if (!travelRequest) {
    return NextResponse.json({ error: "Travel request not found" }, { status: 404 });
  }

  // Authorization check
  const isOwner = travelRequest.employeeId === ctx.employeeId;
  const canApproveFinance = authorize(ctx, PERMISSIONS.TRAVEL_APPROVE_FINANCE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: travelRequest.employeeId,
    resourceType: "travel_request",
  }).allowed;

  if (!isOwner && !canApproveFinance) {
    return NextResponse.json(
      { error: "Forbidden: Only traveler or finance officer can bridge travel to expense report" },
      { status: 403 }
    );
  }

  // Check valid status for expense bridging
  const allowedStatuses = ["manager_approved", "finance_approved", "completed"];
  if (!allowedStatuses.includes(travelRequest.status)) {
    return NextResponse.json(
      { error: `Cannot bridge expenses for travel request in status '${travelRequest.status}'` },
      { status: 400 }
    );
  }

  // If already linked, return existing expense report ID
  if (travelRequest.linkedExpenseReportId) {
    const existing = await prisma.expenseReport.findFirst({
      where: { id: travelRequest.linkedExpenseReportId, tenantId: ctx.tenantId },
    });
    if (existing) {
      return NextResponse.json({
        message: "Expense report already bridged",
        expenseReportId: existing.id,
        alreadyBridged: true,
      });
    }
  }

  const items = await prisma.travelItineraryItem.findMany({
    where: { travelRequestId: id, tenantId: ctx.tenantId },
  });

  const draft = buildExpenseBridgeDraft(travelRequest, items);

  const result = await prisma.$transaction(async (tx) => {
    const expenseReport = await tx.expenseReport.create({
      data: {
        tenantId: ctx.tenantId,
        employeeId: travelRequest.employeeId,
        title: draft.title,
        description: draft.description,
        currency: draft.currency,
        totalAmountCents: draft.totalAmountCents,
        status: "draft",
      },
    });

    for (const item of draft.items) {
      await tx.expenseItem.create({
        data: {
          tenantId: ctx.tenantId,
          reportId: expenseReport.id,
          category: item.category,
          description: item.description,
          amountCents: item.amountCents,
        },
      });
    }

    const updatedRequest = await tx.travelRequest.update({
      where: { id: travelRequest.id },
      data: {
        linkedExpenseReportId: expenseReport.id,
        status: "completed",
      },
    });

    return { expenseReport, updatedRequest };
  });

  return NextResponse.json(
    {
      data: {
        expenseReportId: result.expenseReport.id,
        totalAmountCents: draft.totalAmountCents.toString(),
        itemsCount: draft.items.length,
        status: result.updatedRequest.status,
      },
    },
    { status: 201 }
  );
}
