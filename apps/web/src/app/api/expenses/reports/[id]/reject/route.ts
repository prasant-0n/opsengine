import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { canTransitionExpense, ExpenseStatus } from "@/features/expenses/lib/expenses-policy";

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

  const report = await prisma.expenseReport.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!report) {
    return NextResponse.json({ error: "Expense report not found" }, { status: 404 });
  }

  const isManager = (ctx.reporting?.reportIds ?? []).includes(report.employeeId);
  const isFinance = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_APPROVE_FINANCE, {
    tenantId: ctx.tenantId,
    resourceType: "expense_report",
  }).allowed;

  if (!isManager && !isFinance) {
    return NextResponse.json(
      { error: "Forbidden: Only reporting manager or finance officer can reject an expense report" },
      { status: 403 }
    );
  }

  if (!canTransitionExpense(report.status as ExpenseStatus, "rejected")) {
    return NextResponse.json(
      { error: `Cannot reject report in status '${report.status}'` },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const reason = (body.reason ?? "").trim();
    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: "Rejection reason must be at least 5 characters long" },
        { status: 400 }
      );
    }

    const updated = await prisma.expenseReport.update({
      where: { id: report.id },
      data: {
        status: "rejected",
        rejectionReason: reason,
      },
    });

    return NextResponse.json({
      data: {
        ...updated,
        totalAmountCents: updated.totalAmountCents.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reject report" },
      { status: 400 }
    );
  }
}
