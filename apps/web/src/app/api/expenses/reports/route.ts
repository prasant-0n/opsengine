import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  validateExpenseItem,
  isValidExpenseCategory,
  formatCentsToAmount,
} from "@/features/expenses/lib/expenses-policy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const view = (searchParams.get("view") ?? "self").trim();

  let whereCondition: any = { tenantId: ctx.tenantId };

  if (view === "team") {
    const authz = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_READ_TEAM, {
      tenantId: ctx.tenantId,
      resourceType: "expense_report",
    });
    if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Reports submitted by employees in direct or indirect reporting hierarchy
    const reporteeIds = ctx.reporting?.reportIds ?? [];
    whereCondition.employeeId = { in: reporteeIds };
  } else if (view === "finance") {
    const authz = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_APPROVE_FINANCE, {
      tenantId: ctx.tenantId,
      resourceType: "expense_report",
    });
    if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    whereCondition.status = { in: ["manager_approved", "finance_approved", "paid"] };
  } else {
    // Default: Employee's own submitted reports
    whereCondition.employeeId = ctx.employeeId;
  }

  const reports = await prisma.expenseReport.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
  });

  // Enrich with employee display names
  const empIds = Array.from(new Set(reports.map((r) => r.employeeId)));
  const employees = empIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: empIds }, tenantId: ctx.tenantId },
        select: { id: true, displayName: true, workEmail: true },
      })
    : [];

  const empMap = new Map(employees.map((e) => [e.id, e]));

  const serialized = reports.map((r) => ({
    ...r,
    totalAmountCents: r.totalAmountCents.toString(),
    totalAmountFormatted: formatCentsToAmount(r.totalAmountCents, r.currency),
    employee: empMap.get(r.employeeId) || null,
  }));

  return NextResponse.json({
    data: serialized,
    total: serialized.length,
  });
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx || !ctx.employeeId) {
    return NextResponse.json({ error: "Employee profile required" }, { status: 403 });
  }

  const authz = authorize(ctx, PERMISSIONS.EXPENSE_REPORT_CREATE, {
    tenantId: ctx.tenantId,
    resourceType: "expense_report",
    owningEmployeeId: ctx.employeeId,
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const currency = (body.currency ?? "USD").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!title || title.length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Expense report must contain at least one item" },
        { status: 400 }
      );
    }

    // Validate each item and calculate total
    let totalCents = 0n;
    const validatedItems: Array<{
      category: string;
      description: string;
      amountCents: bigint;
      currency: string;
      receiptId?: string | null;
      policyViolation: boolean;
      violationReason?: string | null;
      spentOn: Date;
    }> = [];

    for (const item of items) {
      const desc = (item.description ?? "").trim();
      const cat = (item.category ?? "other").trim();
      const amountCentsNum = Math.round(Number(item.amountCents));
      const receiptId = item.receiptId ? String(item.receiptId).trim() : null;

      if (!desc) {
        return NextResponse.json(
          { error: "Every item must have a description" },
          { status: 400 }
        );
      }

      if (isNaN(amountCentsNum) || amountCentsNum <= 0) {
        return NextResponse.json(
          { error: "Item amount must be a positive integer in cents" },
          { status: 400 }
        );
      }

      if (!isValidExpenseCategory(cat)) {
        return NextResponse.json(
          { error: `Invalid category: ${cat}` },
          { status: 400 }
        );
      }

      const policyCheck = validateExpenseItem({
        category: cat,
        amountCents: amountCentsNum,
        receiptId,
      });

      const amountBigInt = BigInt(amountCentsNum);
      totalCents += amountBigInt;

      validatedItems.push({
        category: cat,
        description: desc,
        amountCents: amountBigInt,
        currency,
        receiptId,
        policyViolation: policyCheck.policyViolation,
        violationReason: policyCheck.violationReason,
        spentOn: item.spentOn ? new Date(item.spentOn) : new Date(),
      });
    }

    // Create Report and Items transactionally
    const report = await prisma.$transaction(async (tx) => {
      const createdReport = await tx.expenseReport.create({
        data: {
          tenantId: ctx.tenantId,
          employeeId: ctx.employeeId!,
          title,
          description: description || null,
          currency,
          totalAmountCents: totalCents,
          status: "submitted",
          submittedAt: new Date(),
        },
      });

      for (const item of validatedItems) {
        await tx.expenseItem.create({
          data: {
            tenantId: ctx.tenantId,
            reportId: createdReport.id,
            category: item.category,
            description: item.description,
            amountCents: item.amountCents,
            currency: item.currency,
            receiptId: item.receiptId,
            policyViolation: item.policyViolation,
            violationReason: item.violationReason,
            spentOn: item.spentOn,
          },
        });
      }

      return createdReport;
    });

    return NextResponse.json(
      {
        data: {
          ...report,
          totalAmountCents: report.totalAmountCents.toString(),
          totalAmountFormatted: formatCentsToAmount(report.totalAmountCents, report.currency),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create expense report" },
      { status: 400 }
    );
  }
}
