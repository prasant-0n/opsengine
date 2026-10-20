import { describe, it, expect } from "vitest";
import {
  INVOICE_STATUSES,
  RECEIVABLE_STATUSES,
  PAYMENT_METHODS,
  ADJUSTMENT_TYPES,
  DISPUTE_STATUSES,
  AGING_BUCKETS,
  isKnownInvoiceStatus,
  isKnownReceivableStatus,
  isKnownPaymentMethod,
  isKnownAdjustmentType,
  isKnownDisputeStatus,
  isValidAmountCents,
  isValidSignedCents,
  isValidQuantity,
  addCents,
  subCents,
  deriveLineAmount,
  deriveInvoiceTotals,
  deriveReceivable,
  wouldOverpay,
  agingBucket,
  isOverdue,
  formatMoney,
  canIssue,
  canVoid,
  isDraftEditable,
  termsExceedThreshold,
  TERMS_APPROVAL_THRESHOLD_DAYS,
} from "../features/finance/lib/finance";

describe("finance enums", () => {
  it("validates statuses and enums", () => {
    expect(INVOICE_STATUSES).toContain("draft");
    expect(INVOICE_STATUSES).toContain("partially_paid");
    expect(isKnownInvoiceStatus("issued")).toBe(true);
    expect(isKnownInvoiceStatus("nope")).toBe(false);
    expect(RECEIVABLE_STATUSES).toContain("written_off");
    expect(isKnownReceivableStatus("open")).toBe(true);
    expect(isKnownReceivableStatus("bad")).toBe(false);
    expect(PAYMENT_METHODS).toContain("bank_transfer");
    expect(isKnownPaymentMethod("upi")).toBe(true);
    expect(isKnownPaymentMethod("crypto")).toBe(false);
    expect(ADJUSTMENT_TYPES).toContain("write_off");
    expect(isKnownAdjustmentType("credit_note")).toBe(true);
    expect(isKnownAdjustmentType("edit")).toBe(false);
    expect(DISPUTE_STATUSES).toContain("raised");
    expect(isKnownDisputeStatus("resolved")).toBe(true);
    expect(isKnownDisputeStatus("open")).toBe(false);
    expect(AGING_BUCKETS).toEqual(["current", "days1_30", "days31_60", "days61_90", "days90plus"]);
  });
});

describe("money helpers (integer cents only, never float)", () => {
  it("validates amount/quantity integers", () => {
    expect(isValidAmountCents(0)).toBe(true);
    expect(isValidAmountCents(100)).toBe(true);
    expect(isValidAmountCents(-1)).toBe(false);
    expect(isValidAmountCents(1.5)).toBe(false);
    expect(isValidAmountCents("100")).toBe(false);
    expect(isValidSignedCents(-100)).toBe(true);
    expect(isValidSignedCents(2.5)).toBe(false);
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(2.5)).toBe(false);
  });

  it("adds/subtracts cents with integer guards", () => {
    expect(addCents(100, 250)).toBe(350);
    expect(subCents(500, 200)).toBe(300);
    expect(() => addCents(1.1, 2)).toThrow();
    expect(() => subCents(1, 2.2)).toThrow();
  });

  it("derives a line amount without floating point", () => {
    expect(deriveLineAmount(3, 1999)).toBe(5997);
    expect(() => deriveLineAmount(0, 100)).toThrow();
    expect(() => deriveLineAmount(2, -1)).toThrow();
  });

  it("derives invoice totals", () => {
    const totals = deriveInvoiceTotals([{ amountCents: 400000 }, { amountCents: 100000 }], 50000);
    expect(totals).toEqual({ subtotalCents: 500000, taxCents: 50000, totalCents: 550000 });
    expect(() => deriveInvoiceTotals([{ amountCents: -1 }], 0)).toThrow();
  });
});

describe("receivable derivation", () => {
  it("derives open / partially_paid / paid states", () => {
    const open = deriveReceivable({ originalAmountCents: 100000, payments: [], adjustments: [] });
    expect(open).toEqual({ paidAmountCents: 0, outstandingCents: 100000, status: "open" });

    const partial = deriveReceivable({ originalAmountCents: 100000, payments: [{ amountCents: 40000 }], adjustments: [] });
    expect(partial).toEqual({ paidAmountCents: 40000, outstandingCents: 60000, status: "partially_paid" });

    const paid = deriveReceivable({ originalAmountCents: 100000, payments: [{ amountCents: 100000 }], adjustments: [] });
    expect(paid).toEqual({ paidAmountCents: 100000, outstandingCents: 0, status: "paid" });
  });

  it("applies negative adjustments (credit note / write-off) to paid", () => {
    const r = deriveReceivable({
      originalAmountCents: 100000,
      payments: [{ amountCents: 60000 }],
      adjustments: [{ type: "credit_note", amountCents: -10000 }],
    });
    expect(r.paidAmountCents).toBe(50000);
    expect(r.outstandingCents).toBe(50000);
    expect(r.status).toBe("partially_paid");
  });

  it("marks disputed when dispute raised", () => {
    const r = deriveReceivable({ originalAmountCents: 100000, payments: [], adjustments: [], disputeStatus: "raised" });
    expect(r.status).toBe("disputed");
  });

  it("never returns negative outstanding and guards overpay", () => {
    const r = deriveReceivable({
      originalAmountCents: 100000,
      payments: [{ amountCents: 100000 }],
      adjustments: [{ type: "reversal", amountCents: -50000 }],
    });
    expect(r.outstandingCents).toBe(50000);
    expect(wouldOverpay(100000, 80000, 30000)).toBe(true);
    expect(wouldOverpay(100000, 80000, 20000)).toBe(false);
  });
});

describe("aging", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  it("buckets by days overdue", () => {
    expect(agingBucket(new Date("2026-10-25T00:00:00Z"), now)).toBe("current");
    expect(agingBucket(new Date("2026-10-10T00:00:00Z"), now)).toBe("days1_30");
    expect(agingBucket(new Date("2026-09-10T00:00:00Z"), now)).toBe("days31_60");
    expect(agingBucket(new Date("2026-08-10T00:00:00Z"), now)).toBe("days61_90");
    expect(agingBucket(new Date("2026-06-10T00:00:00Z"), now)).toBe("days90plus");
    expect(agingBucket(null, now)).toBe("current");
  });

  it("detects overdue", () => {
    expect(isOverdue(new Date("2026-10-01T00:00:00Z"), 1000, now)).toBe(true);
    expect(isOverdue(new Date("2026-11-01T00:00:00Z"), 1000, now)).toBe(false);
    expect(isOverdue(new Date("2026-10-01T00:00:00Z"), 0, now)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats cents as money", () => {
    expect(formatMoney(440000, "USD")).toBe("USD 4,400.00");
    expect(formatMoney("200000", "EUR")).toBe("EUR 2,000.00");
    expect(formatMoney(5, "USD")).toBe("USD 0.05");
    expect(formatMoney(-505, "USD")).toBe("-USD 5.05");
  });
});

describe("governed-action guards", () => {
  it("allows issue only from draft", () => {
    expect(canIssue({ status: "draft" })).toBe(true);
    expect(canIssue({ status: "issued" })).toBe(false);
  });
  it("allows void from draft/issued, not paid", () => {
    expect(canVoid({ status: "draft" })).toBe(true);
    expect(canVoid({ status: "issued" })).toBe(true);
    expect(canVoid({ status: "paid" })).toBe(false);
  });
  it("draft editability", () => {
    expect(isDraftEditable({ status: "draft" })).toBe(true);
    expect(isDraftEditable({ status: "issued" })).toBe(false);
  });
  it("terms threshold", () => {
    expect(termsExceedThreshold(TERMS_APPROVAL_THRESHOLD_DAYS)).toBe(false);
    expect(termsExceedThreshold(TERMS_APPROVAL_THRESHOLD_DAYS + 1)).toBe(true);
    expect(termsExceedThreshold(90)).toBe(true);
  });
});
