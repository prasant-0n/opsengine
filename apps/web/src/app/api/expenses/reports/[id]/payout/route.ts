import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  canTransitionExpense,
  generateVoucherNumber,
  ExpenseStatus,
} from "@/features/expenses/lib/expenses-policy";

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

  // Check ReBAC Permission
  const authz = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_PAYOUT, {
    tenantId: ctx.tenantId,
    resourceType: "expense_report",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // State machine check
  if (!canTransitionExpense(report.status as ExpenseStatus, "paid")) {
    return NextResponse.json(
      { error: `Cannot mark paid for report in status '${report.status}'. Must be 'finance_approved'.` },
      { status: 400 }
    );
  }

  const voucherNumber = generateVoucherNumber(report.id);

  const updated = await prisma.expenseReport.update({
    where: { id: report.id },
    data: {
      status: "paid",
      voucherNumber,
      paidAt: new Date(),
    },
  });

  return NextResponse.json({
    data: {
      ...updated,
      totalAmountCents: updated.totalAmountCents.toString(),
    },
  });
}
