import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireFinanceAuthz, isResponse, serializeInvoice } from "../_lib";
import { INVOICE_STATUSES, DEFAULT_TERMS_DAYS, isValidAmountCents } from "@/features/finance/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_READ, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "").trim();
  const accountId = (searchParams.get("accountId") ?? "").trim();
  const overdue = searchParams.get("overdue") === "1";
  const q = (searchParams.get("q") ?? "").trim();

  const where: any = { tenantId: ctx.tenantId };
  if (status && (INVOICE_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (accountId) where.accountId = accountId;
  if (q) where.number = { contains: q, mode: "insensitive" };
  if (overdue) {
    where.dueOn = { lt: new Date() };
    where.status = { in: ["issued", "partially_paid", "overdue"] };
  }

  const rows = await prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  const receivables = await prisma.receivable.findMany({ where: { tenantId: ctx.tenantId, invoiceId: { in: rows.map((r) => r.id) } } });
  const outMap = new Map(receivables.map((r) => [r.invoiceId, r.outstandingCents]));
  const invoices = rows.map((r) => ({ ...serializeInvoice(r), outstandingCents: (outMap.get(r.id) ?? 0n).toString() }));
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const auth = await requireFinanceAuthz(PERMISSIONS.FINANCE_INVOICE_CREATE, { resourceType: "invoice" });
  if (isResponse(auth)) return auth;
  const { ctx } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.accountId || typeof body.accountId !== "string") return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  const account = await prisma.crmAccount.findFirst({ where: { id: body.accountId, tenantId: ctx.tenantId }, select: { id: true } });
  if (!account) return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });

  if (body.projectId) {
    const project = await prisma.project.findFirst({ where: { id: body.projectId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }
  if (body.milestoneId) {
    const ms = await prisma.projectMilestone.findFirst({ where: { id: body.milestoneId, tenantId: ctx.tenantId }, select: { id: true } });
    if (!ms) return NextResponse.json({ error: "Invalid milestoneId" }, { status: 400 });
  }

  const paymentTermsDays = body.paymentTermsDays ?? DEFAULT_TERMS_DAYS;
  if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0) return NextResponse.json({ error: "paymentTermsDays must be a non-negative integer" }, { status: 400 });
  const currency = typeof body.currency === "string" && body.currency.length === 3 ? body.currency.toUpperCase() : "USD";
  if (body.taxCents !== undefined && !isValidAmountCents(body.taxCents)) return NextResponse.json({ error: "taxCents must be non-negative integer cents" }, { status: 400 });

  const count = await prisma.invoice.count({ where: { tenantId: ctx.tenantId } });
  const year = new Date().getFullYear();
  const number = `INV-${year}-${String(count + 1).padStart(4, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      number,
      accountId: body.accountId,
      projectId: body.projectId ?? null,
      milestoneId: body.milestoneId ?? null,
      status: "draft",
      currency,
      subtotalCents: 0n,
      taxCents: BigInt(body.taxCents ?? 0),
      totalCents: BigInt(body.taxCents ?? 0),
      paymentTermsDays,
      notes: typeof body.notes === "string" ? body.notes : null,
      createdBy: ctx.userId,
    },
  });
  return NextResponse.json({ invoice: serializeInvoice(invoice) }, { status: 201 });
}
