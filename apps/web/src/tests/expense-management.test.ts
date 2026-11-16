import { describe, it, expect } from "vitest";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  POLICY_LIMITS,
  validateExpenseItem,
  canTransitionExpense,
  formatCentsToAmount,
  generateVoucherNumber,
  isValidExpenseCategory,
  isValidExpenseStatus,
  ExpenseStatus,
} from "../features/expenses/lib/expenses-policy";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { scopeAllows, ResourceScope } from "../lib/permissions/scopes";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #39: Employee Expense Management & Reimbursements", () => {
  describe("1. Category & Status Domain Taxonomy", () => {
    it("recognizes all compliant expense categories", () => {
      expect(isValidExpenseCategory("travel")).toBe(true);
      expect(isValidExpenseCategory("lodging")).toBe(true);
      expect(isValidExpenseCategory("meals")).toBe(true);
      expect(isValidExpenseCategory("software")).toBe(true);
      expect(isValidExpenseCategory("office_supplies")).toBe(true);
      expect(isValidExpenseCategory("equipment")).toBe(true);
      expect(isValidExpenseCategory("other")).toBe(true);
      expect(isValidExpenseCategory("unapproved_crypto")).toBe(false);
    });

    it("recognizes all valid expense report lifecycle statuses", () => {
      expect(isValidExpenseStatus("draft")).toBe(true);
      expect(isValidExpenseStatus("submitted")).toBe(true);
      expect(isValidExpenseStatus("manager_approved")).toBe(true);
      expect(isValidExpenseStatus("finance_approved")).toBe(true);
      expect(isValidExpenseStatus("rejected")).toBe(true);
      expect(isValidExpenseStatus("paid")).toBe(true);
      expect(isValidExpenseStatus("unknown_status")).toBe(false);
    });
  });

  describe("2. Per-Diem & Receipt Policy Engine", () => {
    it("enforces $75.00 daily meals per-diem cap", () => {
      // Under $75.00 ($50.00 = 5000 cents) -> allowed
      const validMeal = validateExpenseItem({
        category: "meals",
        amountCents: 5000,
        receiptId: "rc-1",
      });
      expect(validMeal.policyViolation).toBe(false);
      expect(validMeal.violationReason).toBeNull();

      // Over $75.00 ($85.00 = 8500 cents) -> violation
      const excessiveMeal = validateExpenseItem({
        category: "meals",
        amountCents: 8500,
        receiptId: "rc-1",
      });
      expect(excessiveMeal.policyViolation).toBe(true);
      expect(excessiveMeal.violationReason).toContain("Exceeds maximum daily meal per-diem of $75.00");
    });

    it("enforces $250.00 daily lodging per-diem cap", () => {
      // Under $250 ($220.00 = 22000 cents) -> allowed
      const validHotel = validateExpenseItem({
        category: "lodging",
        amountCents: 22000,
        receiptId: "rc-2",
      });
      expect(validHotel.policyViolation).toBe(false);

      // Over $250 ($320.00 = 32000 cents) -> violation
      const excessiveHotel = validateExpenseItem({
        category: "lodging",
        amountCents: 32000,
        receiptId: "rc-2",
      });
      expect(excessiveHotel.policyViolation).toBe(true);
      expect(excessiveHotel.violationReason).toContain("Exceeds maximum daily lodging per-diem of $250.00");
    });

    it("mandates receipt upload for any single expense exceeding $50.00", () => {
      // Expense <= $50 without receipt ($45.00 = 4500 cents) -> allowed
      const minorExpense = validateExpenseItem({
        category: "office_supplies",
        amountCents: 4500,
        receiptId: null,
      });
      expect(minorExpense.policyViolation).toBe(false);

      // Expense > $50 without receipt ($70.00 = 7000 cents) -> violation
      const majorWithoutReceipt = validateExpenseItem({
        category: "software",
        amountCents: 7000,
        receiptId: null,
      });
      expect(majorWithoutReceipt.policyViolation).toBe(true);
      expect(majorWithoutReceipt.violationReason).toContain("Receipt is mandatory for any single expense exceeding $50.00");

      // Expense > $50 WITH receipt attached -> allowed
      const majorWithReceipt = validateExpenseItem({
        category: "software",
        amountCents: 7000,
        receiptId: "rc-valid-id",
      });
      expect(majorWithReceipt.policyViolation).toBe(false);
    });
  });

  describe("3. Lifecycle State Machine Transitions", () => {
    it("allows valid forward workflow progressions", () => {
      expect(canTransitionExpense("draft", "submitted")).toBe(true);
      expect(canTransitionExpense("submitted", "manager_approved")).toBe(true);
      expect(canTransitionExpense("manager_approved", "finance_approved")).toBe(true);
      expect(canTransitionExpense("finance_approved", "paid")).toBe(true);
    });

    it("allows rejections at manager and finance stages", () => {
      expect(canTransitionExpense("submitted", "rejected")).toBe(true);
      expect(canTransitionExpense("manager_approved", "rejected")).toBe(true);
    });

    it("allows rejected reports to be resubmitted after correction", () => {
      expect(canTransitionExpense("rejected", "submitted")).toBe(true);
    });

    it("strictly disallows skipping approval steps or modifying paid reports", () => {
      expect(canTransitionExpense("draft", "paid")).toBe(false);
      expect(canTransitionExpense("submitted", "paid")).toBe(false);
      expect(canTransitionExpense("paid", "submitted")).toBe(false);
      expect(canTransitionExpense("paid", "draft")).toBe(false);
    });
  });

  describe("4. BigInt Currency Formatting & Payment Voucher Generation", () => {
    it("formats integer cents into formatted currency strings with zero float drift", () => {
      expect(formatCentsToAmount(123456n, "USD")).toBe("$1,234.56");
      expect(formatCentsToAmount(7500, "USD")).toBe("$75.00");
      expect(formatCentsToAmount(0n, "USD")).toBe("$0.00");
    });

    it("generates structured payment voucher references", () => {
      const voucher = generateVoucherNumber("00000000-0000-4000-8000-000000000001");
      const year = new Date().getFullYear();
      expect(voucher).toBe(`VOU-${year}-00000000`);
    });
  });

  describe("5. ReBAC Scoping & Segregation of Duties (SoD)", () => {
    const managerContext: AuthorizationContext = {
      tenantId: "tenant-acme",
      userId: "user-manager-1",
      employeeId: "emp-manager-1",
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        {
          key: PERMISSIONS.EXPENSE_REPORT_APPROVE_MANAGER,
          scopeType: "REPORTING_TREE",
          scopeId: null,
          validTo: null,
        },
      ],
      roles: [{ key: "lead", scopeType: "REPORTING_TREE", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: ["emp-subordinate-1", "emp-subordinate-2"] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows manager to access reports owned by direct reportees", () => {
      const resource: ResourceScope = {
        tenantId: "tenant-acme",
        owningEmployeeId: "emp-subordinate-1",
      };

      const isAllowed = scopeAllows(managerContext, "REPORTING_TREE", null, resource);
      expect(isAllowed).toBe(true);
    });

    it("denies manager access to reports owned by unlinked employees", () => {
      const resource: ResourceScope = {
        tenantId: "tenant-acme",
        owningEmployeeId: "emp-stranger-99",
      };

      const isAllowed = scopeAllows(managerContext, "REPORTING_TREE", null, resource);
      expect(isAllowed).toBe(false);
    });
  });
});
