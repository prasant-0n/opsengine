import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/prisma";
import {
  syncInvoiceToErp,
  ErpProvider,
  ChartOfAccountsMapping,
  InvoiceEntity,
} from "@/features/erp-sync";

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

  const authz = authorize(ctx, PERMISSIONS.ERP_SYNC_EXECUTE, {
    tenantId: ctx.tenantId,
    owningEmployeeId: ctx.employeeId,
    resourceType: "erp_sync_log",
  });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice || invoice.tenantId !== ctx.tenantId) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const [lines, account, receivable] = await Promise.all([
    prisma.invoiceLine.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { lineNumber: "asc" },
    }),
    prisma.crmAccount.findUnique({
      where: { id: invoice.accountId },
      select: { name: true },
    }),
    prisma.receivable.findFirst({
      where: { invoiceId: invoice.id },
      select: { outstandingCents: true },
    }),
  ]);

  const integrations = await prisma.erpIntegration.findMany({
    where: {
      tenantId: ctx.tenantId,
      status: "connected",
    },
  });

  if (integrations.length === 0) {
    return NextResponse.json(
      { error: "No active ERP integrations connected for this tenant." },
      { status: 400 }
    );
  }

  const invoiceEntity: InvoiceEntity = {
    id: invoice.id,
    number: invoice.number,
    tenantId: invoice.tenantId,
    accountId: invoice.accountId,
    accountName: account?.name || undefined,
    status: invoice.status,
    totalCents: invoice.totalCents,
    balanceCents: receivable?.outstandingCents ?? invoice.totalCents,
    currency: invoice.currency,
    issuedAt: invoice.issuedOn,
    dueAt: invoice.dueOn,
    lines: lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      totalCents: l.amountCents,
    })),
  };

  const results = [];
  for (const integration of integrations) {
    const coaMapping = (integration.coaMapping || {}) as ChartOfAccountsMapping;
    const syncResult = await syncInvoiceToErp(
      integration.provider as ErpProvider,
      invoiceEntity,
      coaMapping
    );

    const log = await prisma.erpSyncLog.upsert({
      where: {
        tenantId_provider_entityType_entityId_idempotencyKey: {
          tenantId: ctx.tenantId,
          provider: integration.provider,
          entityType: "invoice",
          entityId: invoice.id,
          idempotencyKey: syncResult.idempotencyKey,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        integrationId: integration.id,
        provider: integration.provider,
        entityType: "invoice",
        entityId: invoice.id,
        externalId: syncResult.externalId || null,
        direction: "outbound",
        status: syncResult.success ? "success" : "failed",
        idempotencyKey: syncResult.idempotencyKey,
        payloadSnapshot: syncResult.payloadSnapshot as any,
        syncedAt: syncResult.success ? new Date() : null,
        errorMessage: syncResult.error || null,
      },
      update: {
        externalId: syncResult.externalId || null,
        status: syncResult.success ? "success" : "failed",
        syncedAt: syncResult.success ? new Date() : null,
        errorMessage: syncResult.error || null,
      },
    });

    if (syncResult.success) {
      await prisma.erpIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
        },
      });
    } else {
      await prisma.erpIntegration.update({
        where: { id: integration.id },
        data: {
          lastError: syncResult.error || "Sync failed",
        },
      });
    }

    results.push({
      provider: integration.provider,
      success: syncResult.success,
      externalId: syncResult.externalId,
      logId: log.id,
      error: syncResult.error,
    });
  }

  return NextResponse.json({
    message: `Invoice sync processed across ${integrations.length} provider(s).`,
    results,
  });
}
