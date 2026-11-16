// Feature #10 — Finance Operations domain library (PRD Module 12).
// Money is integer cents (BigInt in storage, number/string here for arithmetic-free derivation).
// Never use binary floating-point for money.

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const RECEIVABLE_STATUSES = [
  "open",
  "partially_paid",
  "paid",
  "disputed",
  "written_off",
] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

export const PAYMENT_METHODS = [
  "bank_transfer",
  "upi",
  "card",
  "cash",
  "cheque",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ADJUSTMENT_TYPES = ["reversal", "credit_note", "discount", "write_off"] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const DISPUTE_STATUSES = ["none", "raised", "resolved"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const AGING_BUCKETS = ["current", "days1_30", "days31_60", "days61_90", "days90plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

// Adjustments that reduce what is owed (negative effect on paid) vs increase.
const NEGATIVE_ADJUSTMENTS: readonly AdjustmentType[] = ["reversal", "credit_note", "discount", "write_off"];

export function isKnownInvoiceStatus(v: unknown): v is InvoiceStatus {
  return typeof v === "string" && (INVOICE_STATUSES as readonly string[]).includes(v);
}

export function isKnownReceivableStatus(v: unknown): v is ReceivableStatus {
  return typeof v === "string" && (RECEIVABLE_STATUSES as readonly string[]).includes(v);
}

export function isKnownPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

export function isKnownAdjustmentType(v: unknown): v is AdjustmentType {
  return typeof v === "string" && (ADJUSTMENT_TYPES as readonly string[]).includes(v);
}

export function isKnownDisputeStatus(v: unknown): v is DisputeStatus {
  return typeof v === "string" && (DISPUTE_STATUSES as readonly string[]).includes(v);
}

// ---- Money helpers (integer cents only) ----

export function isValidAmountCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

export function isValidSignedCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

export function isValidQuantity(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function addCents(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error("addCents requires integer cents");
  return a + b;
}

export function subCents(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error("subCents requires integer cents");
  return a - b;
}

export function deriveLineAmount(quantity: number, unitPriceCents: number): number {
  if (!isValidQuantity(quantity)) throw new Error("quantity must be a positive integer");
  if (!isValidAmountCents(unitPriceCents)) throw new Error("unitPriceCents must be non-negative integer cents");
  return quantity * unitPriceCents;
}

export function deriveInvoiceTotals(
  lines: Array<{ amountCents: number }>,
  taxCents: number,
): { subtotalCents: number; taxCents: number; totalCents: number } {
  if (!isValidAmountCents(taxCents)) throw new Error("taxCents must be non-negative integer cents");
  let subtotalCents = 0;
  for (const l of lines) {
    if (!isValidAmountCents(l.amountCents)) throw new Error("line amountCents must be non-negative integer cents");
    subtotalCents += l.amountCents;
  }
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

// ---- Receivable derivation ----

export interface ReceivableInput {
  originalAmountCents: number;
  payments: Array<{ amountCents: number }>;
  adjustments: Array<{ type: AdjustmentType; amountCents: number }>;
  disputeStatus?: DisputeStatus;
}

export function deriveReceivable(input: ReceivableInput): {
  paidAmountCents: number;
  outstandingCents: number;
  status: ReceivableStatus;
} {
  const { originalAmountCents, payments, adjustments, disputeStatus = "none" } = input;
  if (!isValidAmountCents(originalAmountCents)) throw new Error("originalAmountCents must be non-negative integer cents");

  let paid = 0;
  for (const p of payments) {
    if (!isValidAmountCents(p.amountCents)) throw new Error("payment amountCents must be non-negative integer cents");
    paid += p.amountCents;
  }
  for (const a of adjustments) {
    if (!isValidSignedCents(a.amountCents)) throw new Error("adjustment amountCents must be integer cents");
    if (NEGATIVE_ADJUSTMENTS.includes(a.type)) paid -= Math.abs(a.amountCents);
    else paid += a.amountCents;
  }
  if (paid < 0) paid = 0;
  const outstanding = Math.max(0, originalAmountCents - paid);

  let status: ReceivableStatus;
  if (disputeStatus === "raised") status = "disputed";
  else if (outstanding === 0 && originalAmountCents > 0) status = "paid";
  else if (paid > 0) status = "partially_paid";
  else status = "open";

  return { paidAmountCents: paid, outstandingCents: outstanding, status };
}

export function wouldOverpay(originalAmountCents: number, alreadyPaidCents: number, newPaymentCents: number): boolean {
  if (!isValidAmountCents(originalAmountCents)) throw new Error("originalAmountCents must be non-negative integer cents");
  if (!isValidAmountCents(alreadyPaidCents)) throw new Error("alreadyPaidCents must be non-negative integer cents");
  if (!isValidAmountCents(newPaymentCents)) throw new Error("newPaymentCents must be non-negative integer cents");
  return alreadyPaidCents + newPaymentCents > originalAmountCents;
}

// ---- Aging ----

export function agingBucket(dueOn: Date | null | undefined, now: Date): AgingBucket {
  if (!dueOn) return "current";
  const ms = now.getTime() - dueOn.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "current";
  if (days <= 30) return "days1_30";
  if (days <= 60) return "days31_60";
  if (days <= 90) return "days61_90";
  return "days90plus";
}

export function isOverdue(dueOn: Date | null | undefined, outstandingCents: number, now: Date): boolean {
  if (outstandingCents <= 0) return false;
  if (!dueOn) return false;
  return dueOn.getTime() < now.getTime();
}

// ---- Formatting (display only; storage stays integer cents) ----

export function formatMoney(cents: number | bigint | string, currency = "USD"): string {
  const n = typeof cents === "bigint" ? Number(cents) : typeof cents === "string" ? Number(cents) : cents;
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const wholeStr = whole.toLocaleString("en-US");
  return `${sign}${currency} ${wholeStr}.${frac}`;
}

// ---- Governed-action guards ----

export function canIssue(invoice: { status: string }): boolean {
  return invoice.status === "draft";
}

export function canVoid(invoice: { status: string }): boolean {
  return invoice.status === "draft" || invoice.status === "issued";
}

export function isDraftEditable(invoice: { status: string }): boolean {
  return invoice.status === "draft";
}

export const DEFAULT_TERMS_DAYS = 30;
// Payment terms beyond this many days require a commercial-exception approval.
export const TERMS_APPROVAL_THRESHOLD_DAYS = 45;
// Write-offs at or above this amount require approval / the commercial-terms permission.
export const WRITE_OFF_APPROVAL_THRESHOLD_CENTS = 100_000;

export function termsExceedThreshold(paymentTermsDays: number): boolean {
  return Number.isInteger(paymentTermsDays) && paymentTermsDays > TERMS_APPROVAL_THRESHOLD_DAYS;
}
