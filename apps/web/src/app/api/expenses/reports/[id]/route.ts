import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import { formatCentsToAmount } from "@/features/expenses/lib/expenses-policy";

export const dynamic = "force-dynamic";

export async function GET(
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

  // Authoritative ReBAC Check:
  const isOwner = report.employeeId === ctx.employeeId;
  const isManager = (ctx.reporting?.reportIds ?? []).includes(report.employeeId);
  const isFinance = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_APPROVE_FINANCE, {
    tenantId: ctx.tenantId,
    resourceType: "expense_report",
  }).allowed;

  if (!isOwner && !isManager && !isFinance) {
    return NextResponse.json(
      { error: "Forbidden: Access denied to this expense report" },
      { status: 403 }
    );
  }

  const [items, submitter, managerApprover, financeApprover] = await Promise.all([
    prisma.expenseItem.findMany({
      where: { reportId: report.id, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.employee.findFirst({
      where: { id: report.employeeId, tenantId: ctx.tenantId },
      select: { id: true, displayName: true, workEmail: true },
    }),
    report.managerApproverId
      ? prisma.employee.findFirst({
          where: { id: report.managerApproverId, tenantId: ctx.tenantId },
          select: { id: true, displayName: true },
        })
      : null,
    report.financeApproverId
      ? prisma.employee.findFirst({
          where: { id: report.financeApproverId, tenantId: ctx.tenantId },
          select: { id: true, displayName: true },
        })
      : null,
  ]);

  // Fetch receipts for items if attached
  const receiptIds = items.map((i) => i.receiptId).filter((r): r is string => !!r);
  const receipts = receiptIds.length
    ? await prisma.expenseReceipt.findMany({
        where: { id: { in: receiptIds }, tenantId: ctx.tenantId },
      })
    : [];

  const receiptMap = new Map(receipts.map((rc) => [rc.id, rc]));

  const enrichedItems = items.map((it) => ({
    ...it,
    amountCents: it.amountCents.toString(),
    amountFormatted: formatCentsToAmount(it.amountCents, it.currency),
    receipt: it.receiptId ? receiptMap.get(it.receiptId) || null : null,
  }));

  return NextResponse.json({
    data: {
      ...report,
      totalAmountCents: report.totalAmountCents.toString(),
      totalAmountFormatted: formatCentsToAmount(report.totalAmountCents, report.currency),
      submitter,
      managerApprover,
      financeApprover,
      items: enrichedItems,
    },
  });
}
