import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeReceivable, serializePayment } from "../_lib";
import { agingBucket, AGING_BUCKETS, isOverdue } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_RECEIVABLE_READ, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();

  const where: any = { tenantId: ctx.tenantId };
  if (status) where.status = status;

  const rows = await prisma.receivable.findMany({ where, orderBy: { dueOn: "asc" }, take: 500 });
  const invoiceIds = rows.map((r) => r.invoiceId);
  const invoices = await prisma.invoice.findMany({ where: { tenantId: ctx.tenantId, id: { in: invoiceIds } }, select: { id: true, number: true, accountId: true, projectId: true, status: true, disputeStatus: true } });
  const invMap = new Map(invoices.map((i) => [i.id, i]));

  const now = new Date();
  const summary: Record<string, number> = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 };
  const receivables = rows.map((r) => {
    const inv = invMap.get(r.invoiceId);
    const bucket = agingBucket(r.dueOn, now);
    if (r.outstandingCents > 0n) summary[bucket] = (summary[bucket] ?? 0) + Number(r.outstandingCents);
    return {
      ...serializeReceivable(r),
      invoiceNumber: inv?.number ?? null,
      accountId: inv?.accountId ?? null,
      projectId: inv?.projectId ?? null,
      disputeStatus: inv?.disputeStatus ?? "none",
      agingBucket: bucket,
      overdue: isOverdue(r.dueOn, Number(r.outstandingCents), now),
    };
  });

  const payments = await prisma.payment.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { receivedOn: "desc" }, take: 50 });
  return NextResponse.json({
    receivables,
    summary: {
      current: summary.current.toString(),
      days1_30: summary.days1_30.toString(),
      days31_60: summary.days31_60.toString(),
      days61_90: summary.days61_90.toString(),
      days90plus: summary.days90plus.toString(),
    },
    recentPayments: payments.map((p) => ({ ...serializePayment(p), invoiceId: p.invoiceId })),
  });
}
