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

  // SoD: Employee cannot approve own expense claim
  if (report.employeeId === ctx.employeeId) {
    return NextResponse.json(
      { error: "Segregation of Duties Violation: You cannot approve your own expense report" },
      { status: 403 }
    );
  }

  // Check ReBAC Permission
  const authz = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_APPROVE_FINANCE, {
    tenantId: ctx.tenantId,
    resourceType: "expense_report",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // State machine check
  if (!canTransitionExpense(report.status as ExpenseStatus, "finance_approved")) {
    return NextResponse.json(
      { error: `Cannot perform finance approval on report in status '${report.status}'` },
      { status: 400 }
    );
  }

  const updated = await prisma.expenseReport.update({
    where: { id: report.id },
    data: {
      status: "finance_approved",
      financeApproverId: ctx.employeeId,
      approvedAt: new Date(),
    },
  });

  return NextResponse.json({
    data: {
      ...updated,
      totalAmountCents: updated.totalAmountCents.toString(),
    },
  });
}
