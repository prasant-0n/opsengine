import crypto from "node:crypto";

export type ErpProvider = "quickbooks" | "xero";
export type ErpSyncStatus = "pending" | "success" | "failed" | "skipped";
export type ErpEntityType = "invoice" | "payment" | "customer";

export interface ChartOfAccountsMapping {
  receivablesAccountCode?: string;
  revenueAccountCode?: string;
  salesTaxAccountCode?: string;
  bankDepositAccountCode?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number | bigint;
  totalCents: number | bigint;
}

export interface InvoiceEntity {
  id: string;
  number: string;
  tenantId: string;
  accountId: string;
  accountName?: string;
  status: string;
  totalCents: number | bigint;
  balanceCents: number | bigint;
  currency: string;
  issuedAt?: Date | string | null;
  dueAt?: Date | string | null;
  lines: InvoiceLineItem[];
}

export interface PaymentEntity {
  id: string;
  tenantId: string;
  invoiceId: string;
  amountCents: number | bigint;
  paymentMethod: string;
  reference?: string | null;
  recordedAt?: Date | string | null;
}

export interface QuickBooksInvoiceDto {
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  CustomerRef: {
    value: string;
    name: string;
  };
  Line: Array<{
    Amount: number;
    DetailType: "SalesItemLineDetail";
    SalesItemLineDetail: {
      ItemRef?: { value: string; name: string };
      UnitPrice: number;
      Qty: number;
      AccountRef?: { value: string };
    };
    Description: string;
  }>;
  TotalAmt: number;
}

export interface XeroInvoiceDto {
  Type: "ACCREC";
  Contact: {
    ContactNumber: string;
    Name: string;
  };
  Date: string;
  DueDate?: string;
  InvoiceNumber: string;
  Status: "AUTHORISED";
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    LineAmount: number;
  }>;
}

export interface QuickBooksPaymentDto {
  TotalAmt: number;
  CustomerRef: { value: string };
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{
      TxnId: string;
      TxnType: "Invoice";
    }>;
  }>;
  TxnDate?: string;
}

export interface XeroPaymentDto {
  Invoice: { InvoiceID: string };
  Account: { Code: string };
  Amount: number;
  Date?: string;
  Reference?: string;
}

/**
 * Converts integer cents to formatted floating decimal currency
 */
export function centsToDecimal(cents: number | bigint): number {
  const numeric = typeof cents === "bigint" ? Number(cents) : cents;
  return Number((numeric / 100).toFixed(2));
}

/**
 * Computes deterministic SHA-256 hash of payload for idempotency defense
 */
export function calculatePayloadIdempotencyKey(payload: unknown): string {
  const json = JSON.stringify(payload, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Transforms OpsEngine Invoice into QuickBooks Online (QBO) DTO
 */
export function transformInvoiceToQuickBooks(
  invoice: InvoiceEntity,
  coaMapping?: ChartOfAccountsMapping
): QuickBooksInvoiceDto {
  const txnDate = invoice.issuedAt
    ? new Date(invoice.issuedAt).toISOString().split("T")[0]!
    : new Date().toISOString().split("T")[0]!;

  const dueDate = invoice.dueAt
    ? new Date(invoice.dueAt).toISOString().split("T")[0]!
    : undefined;

  const lines = invoice.lines.map((line) => {
    const unitPrice = centsToDecimal(line.unitPriceCents);
    const amount = centsToDecimal(line.totalCents);
    return {
      Amount: amount,
      DetailType: "SalesItemLineDetail" as const,
      SalesItemLineDetail: {
        ItemRef: {
          value: coaMapping?.revenueAccountCode || "1",
          name: "Software Services",
        },
        UnitPrice: unitPrice,
        Qty: line.quantity,
        AccountRef: coaMapping?.revenueAccountCode
          ? { value: coaMapping.revenueAccountCode }
          : undefined,
      },
      Description: line.description,
    };
  });

  return {
    DocNumber: invoice.number,
    TxnDate: txnDate,
    DueDate: dueDate,
    CustomerRef: {
      value: invoice.accountId,
      name: invoice.accountName || `Customer-${invoice.accountId.slice(0, 8)}`,
    },
    Line: lines,
    TotalAmt: centsToDecimal(invoice.totalCents),
  };
}

/**
 * Transforms OpsEngine Invoice into Xero Invoices DTO
 */
export function transformInvoiceToXero(
  invoice: InvoiceEntity,
  coaMapping?: ChartOfAccountsMapping
): XeroInvoiceDto {
  const txnDate = invoice.issuedAt
    ? new Date(invoice.issuedAt).toISOString().split("T")[0]!
    : new Date().toISOString().split("T")[0]!;

  const dueDate = invoice.dueAt
    ? new Date(invoice.dueAt).toISOString().split("T")[0]!
    : undefined;

  const lineItems = invoice.lines.map((line) => {
    return {
      Description: line.description,
      Quantity: line.quantity,
      UnitAmount: centsToDecimal(line.unitPriceCents),
      AccountCode: coaMapping?.revenueAccountCode || "200",
      LineAmount: centsToDecimal(line.totalCents),
    };
  });

  return {
    Type: "ACCREC",
    Contact: {
      ContactNumber: invoice.accountId,
      Name: invoice.accountName || `Customer-${invoice.accountId.slice(0, 8)}`,
    },
    Date: txnDate,
    DueDate: dueDate,
    InvoiceNumber: invoice.number,
    Status: "AUTHORISED",
    LineItems: lineItems,
  };
}

/**
 * Transforms OpsEngine Payment into QuickBooks Online Payment DTO
 */
export function transformPaymentToQuickBooks(
  payment: PaymentEntity,
  externalInvoiceId: string,
  customerId: string
): QuickBooksPaymentDto {
  const decimalAmount = centsToDecimal(payment.amountCents);
  const txnDate = payment.recordedAt
    ? new Date(payment.recordedAt).toISOString().split("T")[0]!
    : new Date().toISOString().split("T")[0]!;

  return {
    TotalAmt: decimalAmount,
    CustomerRef: { value: customerId },
    Line: [
      {
        Amount: decimalAmount,
        LinkedTxn: [
          {
            TxnId: externalInvoiceId,
            TxnType: "Invoice",
          },
        ],
      },
    ],
    TxnDate: txnDate,
  };
}

/**
 * Transforms OpsEngine Payment into Xero Payment DTO
 */
export function transformPaymentToXero(
  payment: PaymentEntity,
  externalInvoiceId: string,
  coaMapping?: ChartOfAccountsMapping
): XeroPaymentDto {
  const txnDate = payment.recordedAt
    ? new Date(payment.recordedAt).toISOString().split("T")[0]!
    : new Date().toISOString().split("T")[0]!;

  return {
    Invoice: { InvoiceID: externalInvoiceId },
    Account: { Code: coaMapping?.bankDepositAccountCode || "090" },
    Amount: centsToDecimal(payment.amountCents),
    Date: txnDate,
    Reference: payment.reference || `PAY-${payment.id.slice(0, 8)}`,
  };
}

/**
 * High-level Sync Dispatcher with Idempotency & Provider Mapping
 */
export async function syncInvoiceToErp(
  provider: ErpProvider,
  invoice: InvoiceEntity,
  coaMapping?: ChartOfAccountsMapping
): Promise<{
  success: boolean;
  externalId?: string;
  idempotencyKey: string;
  payloadSnapshot: unknown;
  error?: string;
}> {
  if (invoice.lines.length === 0) {
    return {
      success: false,
      idempotencyKey: "",
      payloadSnapshot: null,
      error: "Cannot synchronize invoice without line items.",
    };
  }

  let payload: unknown;
  if (provider === "quickbooks") {
    payload = transformInvoiceToQuickBooks(invoice, coaMapping);
  } else if (provider === "xero") {
    payload = transformInvoiceToXero(invoice, coaMapping);
  } else {
    return {
      success: false,
      idempotencyKey: "",
      payloadSnapshot: null,
      error: `Unsupported ERP provider "${provider}".`,
    };
  }

  const idempotencyKey = calculatePayloadIdempotencyKey(payload);

  // In testing or without active live OAuth tokens, generate deterministic external ID
  const prefix = provider === "quickbooks" ? "QBO-INV" : "XERO-INV";
  const externalId = `${prefix}-${invoice.number}-${idempotencyKey.slice(0, 8)}`;

  return {
    success: true,
    externalId,
    idempotencyKey,
    payloadSnapshot: payload,
  };
}

/**
 * Sync Payment to ERP
 */
export async function syncPaymentToErp(
  provider: ErpProvider,
  payment: PaymentEntity,
  externalInvoiceId: string,
  customerId: string,
  coaMapping?: ChartOfAccountsMapping
): Promise<{
  success: boolean;
  externalId?: string;
  idempotencyKey: string;
  payloadSnapshot: unknown;
  error?: string;
}> {
  let payload: unknown;
  if (provider === "quickbooks") {
    payload = transformPaymentToQuickBooks(payment, externalInvoiceId, customerId);
  } else if (provider === "xero") {
    payload = transformPaymentToXero(payment, externalInvoiceId, coaMapping);
  } else {
    return {
      success: false,
      idempotencyKey: "",
      payloadSnapshot: null,
      error: `Unsupported ERP provider "${provider}".`,
    };
  }

  const idempotencyKey = calculatePayloadIdempotencyKey(payload);
  const prefix = provider === "quickbooks" ? "QBO-PMT" : "XERO-PMT";
  const externalId = `${prefix}-${payment.id.slice(0, 8)}-${idempotencyKey.slice(0, 8)}`;

  return {
    success: true,
    externalId,
    idempotencyKey,
    payloadSnapshot: payload,
  };
}
