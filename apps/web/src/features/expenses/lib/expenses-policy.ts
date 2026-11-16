export const EXPENSE_CATEGORIES = [
  "travel",
  "lodging",
  "meals",
  "software",
  "office_supplies",
  "equipment",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = [
  "draft",
  "submitted",
  "manager_approved",
  "finance_approved",
  "rejected",
  "paid",
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const POLICY_LIMITS = {
  MEAL_DAILY_MAX_CENTS: 7500, // $75.00
  LODGING_DAILY_MAX_CENTS: 25000, // $250.00
  RECEIPT_REQUIRED_THRESHOLD_CENTS: 5000, // $50.00
} as const;

export function isValidExpenseCategory(category: string): category is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(category);
}

export function isValidExpenseStatus(status: string): status is ExpenseStatus {
  return (EXPENSE_STATUSES as readonly string[]).includes(status);
}

/**
 * Validates a single expense line item against enterprise per-diem and receipt compliance policies.
 */
export function validateExpenseItem(item: {
  category: string;
  amountCents: number | bigint;
  receiptId?: string | null;
}): { policyViolation: boolean; violationReason: string | null } {
  const amount = Number(item.amountCents);

  // 1. Meals Daily Per-Diem Cap ($75.00)
  if (item.category === "meals" && amount > POLICY_LIMITS.MEAL_DAILY_MAX_CENTS) {
    return {
      policyViolation: true,
      violationReason: `Exceeds maximum daily meal per-diem of $${(
        POLICY_LIMITS.MEAL_DAILY_MAX_CENTS / 100
      ).toFixed(2)}`,
    };
  }

  // 2. Lodging Daily Cap ($250.00)
  if (item.category === "lodging" && amount > POLICY_LIMITS.LODGING_DAILY_MAX_CENTS) {
    return {
      policyViolation: true,
      violationReason: `Exceeds maximum daily lodging per-diem of $${(
        POLICY_LIMITS.LODGING_DAILY_MAX_CENTS / 100
      ).toFixed(2)}`,
    };
  }

  // 3. Mandatory Receipt Check (Required for any item > $50.00)
  if (amount > POLICY_LIMITS.RECEIPT_REQUIRED_THRESHOLD_CENTS && !item.receiptId) {
    return {
      policyViolation: true,
      violationReason: `Receipt is mandatory for any single expense exceeding $${(
        POLICY_LIMITS.RECEIPT_REQUIRED_THRESHOLD_CENTS / 100
      ).toFixed(2)}`,
    };
  }

  return {
    policyViolation: false,
    violationReason: null,
  };
}

/**
 * Evaluates whether an expense report state transition is valid.
 */
export function canTransitionExpense(from: ExpenseStatus, to: ExpenseStatus): boolean {
  switch (from) {
    case "draft":
      return to === "submitted";
    case "submitted":
      return to === "manager_approved" || to === "rejected";
    case "manager_approved":
      return to === "finance_approved" || to === "rejected";
    case "finance_approved":
      return to === "paid";
    case "rejected":
      return to === "submitted"; // Employee may fix and resubmit
    case "paid":
      return false; // Terminal state
    default:
      return false;
  }
}

/**
 * Formats BigInt integer cents to human-readable currency ($1,234.56).
 */
export function formatCentsToAmount(cents: number | bigint, currency = "USD"): string {
  const num = Number(cents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

/**
 * Generates an immutable, sequential reimbursement payment voucher number.
 */
export function generateVoucherNumber(reportId: string): string {
  const shortId = reportId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const year = new Date().getFullYear();
  return `VOU-${year}-${shortId}`;
}
