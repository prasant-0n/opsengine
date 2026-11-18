import { describe, it, expect } from "vitest";
import {
  PAYROLL_STATUSES,
  PAYSLIP_STATUSES,
  calculatePayslipAmounts,
  generatePayslipChecksum,
  verifyPayslipIntegrity,
  canTransitionPayrollRun,
  generateBankBatchExport,
  formatCentsToAmount,
  isValidPayrollStatus,
  isValidPayslipStatus,
  PayrollRunStatus,
  PayslipStatus,
} from "../features/payroll/lib/payroll-engine";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { scopeAllows, ResourceScope } from "../lib/permissions/scopes";
import { authorize } from "../lib/permissions/engine";
import type { AuthorizationContext } from "../lib/permissions/context";

describe("Feature #40: Statutory Payroll, Taxes & Payslips", () => {
  describe("1. Domain Taxonomy & Status Validation", () => {
    it("recognizes all valid payroll run lifecycle statuses", () => {
      const initial: PayrollRunStatus = "draft";
      expect(PAYROLL_STATUSES).toContain(initial);
      expect(isValidPayrollStatus("draft")).toBe(true);
      expect(isValidPayrollStatus("calculated")).toBe(true);
      expect(isValidPayrollStatus("approved")).toBe(true);
      expect(isValidPayrollStatus("disbursed")).toBe(true);
      expect(isValidPayrollStatus("cancelled")).toBe(true);
      expect(isValidPayrollStatus("invalid_status")).toBe(false);
    });

    it("recognizes all valid payslip lifecycle statuses", () => {
      const initial: PayslipStatus = "draft";
      expect(PAYSLIP_STATUSES).toContain(initial);
      expect(isValidPayslipStatus("draft")).toBe(true);
      expect(isValidPayslipStatus("generated")).toBe(true);
      expect(isValidPayslipStatus("published")).toBe(true);
      expect(isValidPayslipStatus("paid")).toBe(true);
      expect(isValidPayslipStatus("revoked")).toBe(false);
    });
  });

  describe("2. Salary Calculations & Loss of Pay (LOP) Engine", () => {
    it("accurately computes gross pay, statutory deductions, and net pay with zero float drift", () => {
      // Basic: $5,000.00 (500,000 cents)
      // HRA: $2,000.00 (200,000 cents)
      // Allowances: $1,000.00 (100,000 cents)
      // PF: $600.00 (60,000 cents)
      // TDS: $800.00 (80,000 cents)
      const res = calculatePayslipAmounts({
        salary: {
          basicCents: 500000n,
          hraCents: 200000n,
          allowanceCents: 100000n,
          pfEmployeeCents: 60000n,
          pfEmployerCents: 60000n,
          taxTdsCents: 80000n,
        },
        workingDays: 30,
        workedDays: 30,
        unpaidLeaveDays: 0,
      });

      // Gross Pay = 500k + 200k + 100k = 800,000 cents ($8,000.00)
      expect(res.grossPayCents).toBe(800000n);
      // LOP should be zero
      expect(res.lopDeductionCents).toBe(0n);
      // Total Deductions = 60k + 80k = 140,000 cents ($1,400.00)
      expect(res.totalDeductionsCents).toBe(140000n);
      // Net Pay = 800k - 140k = 660,000 cents ($6,600.00)
      expect(res.netPayCents).toBe(660000n);
    });

    it("enforces attendance-linked Loss of Pay (LOP) deductions for unpaid leave days", () => {
      // Basic: $6,000.00 (600,000 cents), 30 working days -> $200.00/day
      // 3 unpaid leave days -> 3 * $200.00 = $600.00 LOP (60,000 cents)
      const res = calculatePayslipAmounts({
        salary: {
          basicCents: 600000n,
          hraCents: 200000n,
          allowanceCents: 100000n,
          pfEmployeeCents: 50000n,
          pfEmployerCents: 50000n,
          taxTdsCents: 70000n,
        },
        workingDays: 30,
        workedDays: 27,
        unpaidLeaveDays: 3,
      });

      expect(res.grossPayCents).toBe(900000n);
      expect(res.lopDeductionCents).toBe(60000n);
      // Total deductions: PF (50k) + TDS (70k) + LOP (60k) = 180,000 cents
      expect(res.totalDeductionsCents).toBe(180000n);
      // Net Pay = 900k - 180k = 720,000 cents ($7,200.00)
      expect(res.netPayCents).toBe(720000n);
    });

    it("prevents negative net pay overflow when deductions exceed gross wages", () => {
      const res = calculatePayslipAmounts({
        salary: {
          basicCents: 100000n,
          hraCents: 0n,
          allowanceCents: 0n,
          pfEmployeeCents: 80000n,
          pfEmployerCents: 80000n,
          taxTdsCents: 50000n, // Deductions = 130k > Gross 100k
        },
        workingDays: 30,
        workedDays: 30,
        unpaidLeaveDays: 0,
      });

      expect(res.netPayCents).toBe(0n);
    });
  });

  describe("3. Cryptographic Tamper Evidence (SHA-256)", () => {
    const payload = {
      tenantId: "00000000-0000-4000-8000-000000000001",
      payrollRunId: "11111111-1111-4000-8000-111111111111",
      employeeId: "22222222-2222-4000-8000-222222222222",
      payslipNumber: "PAY-202611-0001",
      periodYear: 2026,
      periodMonth: 11,
      grossPayCents: 800000n,
      totalDeductionsCents: 140000n,
      netPayCents: 660000n,
    };

    it("generates deterministic 64-character SHA-256 checksums", () => {
      const hash1 = generatePayslipChecksum(payload);
      const hash2 = generatePayslipChecksum(payload);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
    });

    it("verifies genuine unmodified payslips as authentic", () => {
      const hash = generatePayslipChecksum(payload);
      const isValid = verifyPayslipIntegrity(hash, payload);
      expect(isValid).toBe(true);
    });

    it("detects and flags any tampering with payslip amounts or identifiers", () => {
      const genuineHash = generatePayslipChecksum(payload);

      // Fraudulent attempt to inflate net pay
      const tamperedPayload = {
        ...payload,
        netPayCents: 999999n,
      };

      const isValid = verifyPayslipIntegrity(genuineHash, tamperedPayload);
      expect(isValid).toBe(false);
    });
  });

  describe("4. Lifecycle State Machine Transitions", () => {
    it("allows valid forward payroll workflow progression", () => {
      expect(canTransitionPayrollRun("draft", "calculated")).toBe(true);
      expect(canTransitionPayrollRun("calculated", "approved")).toBe(true);
      expect(canTransitionPayrollRun("approved", "disbursed")).toBe(true);
    });

    it("strictly disallows skipping approval steps or modifying disbursed runs", () => {
      // Cannot skip calculation straight to disbursed
      expect(canTransitionPayrollRun("draft", "disbursed")).toBe(false);
      // Disbursed runs are immutable
      expect(canTransitionPayrollRun("disbursed", "draft")).toBe(false);
      expect(canTransitionPayrollRun("disbursed", "calculated")).toBe(false);
      expect(canTransitionPayrollRun("disbursed", "approved")).toBe(false);
    });
  });

  describe("5. NACHA / ACH Bank Batch Direct Deposit Export", () => {
    it("generates compliant ACH / NEFT batch export records with correct headers and trailer checksums", () => {
      const batch = generateBankBatchExport({
        runNumber: "PR-2026-11",
        periodYear: 2026,
        periodMonth: 11,
        records: [
          {
            payslipNumber: "PAY-202611-0001",
            employeeName: "Alice Walker",
            employeeEmail: "alice@acme.com",
            bankAccountNumber: "1234567890",
            bankRoutingCode: "021000021",
            netPayCents: 650000n, // $6,500.00
            currency: "USD",
          },
          {
            payslipNumber: "PAY-202611-0002",
            employeeName: "Bob Builder",
            employeeEmail: "bob@acme.com",
            bankAccountNumber: "9876543210",
            bankRoutingCode: "021000021",
            netPayCents: 450000n, // $4,500.00
            currency: "USD",
          },
        ],
      });

      const lines = batch.split("\n");
      expect(lines.length).toBe(4); // Header + 2 Details + Trailer

      // Header record (Record Type 1)
      expect(lines[0].startsWith("1,1000000000,OPSENGINE_PAYROLL,PR-2026-11")).toBe(true);

      // Detail records (Record Type 6)
      expect(lines[1]).toContain("021000021,1234567890,6500.00,PAY-202611-0001,Alice Walker");
      expect(lines[2]).toContain("021000021,9876543210,4500.00,PAY-202611-0002,Bob Builder");

      // Trailer record (Record Type 9, 2 records, total $11,000.00)
      expect(lines[3]).toContain("9,000002,11000.00,OPSENGINE_BATCH_TRAILER");
    });

    it("formats integer cents into formatted currency strings", () => {
      expect(formatCentsToAmount(650000n)).toBe("$6,500.00");
      expect(formatCentsToAmount(0n)).toBe("$0.00");
    });
  });

  describe("6. ReBAC Scoping & Segregation of Duties (SoD)", () => {
    const tenantA = "00000000-0000-4000-8000-000000000001";
    const tenantB = "00000000-0000-4000-8000-000000000002";
    const employeeAlice = "11111111-1111-4000-8000-111111111111";
    const employeeBob = "22222222-2222-4000-8000-222222222222";

    const employeeAliceContext: AuthorizationContext = {
      tenantId: tenantA,
      userId: "user-alice",
      employeeId: employeeAlice,
      membershipStatus: "active",
      assurance: { mfa: false },
      permissions: [
        {
          key: PERMISSIONS.PAYSLIP_READ_SELF,
          scopeType: "SELF",
          scopeId: null,
          validTo: null,
        },
      ],
      roles: [{ key: "employee", scopeType: "SELF", scopeId: null }],
      teamMemberships: [],
      reporting: { managerIds: [], reportIds: [] },
      accessGroupIds: [],
      policyVersion: 1,
      builtAt: Date.now(),
    };

    it("allows employee to view their own payslip under SELF scope", () => {
      const resource: ResourceScope = {
        tenantId: tenantA,
        owningEmployeeId: employeeAlice,
      };

      const allowed = scopeAllows(employeeAliceContext, "SELF", null, resource);
      expect(allowed).toBe(true);
    });

    it("denies employee from accessing another employee's payslip under SELF scope", () => {
      const resource: ResourceScope = {
        tenantId: tenantA,
        owningEmployeeId: employeeBob, // Different employee!
      };

      const allowed = scopeAllows(employeeAliceContext, "SELF", null, resource);
      expect(allowed).toBe(false);
    });

    it("strictly isolates payslips across different tenants", () => {
      const financeContext: AuthorizationContext = {
        tenantId: tenantA,
        userId: "user-alice",
        employeeId: employeeAlice,
        membershipStatus: "active",
        assurance: { mfa: false },
        permissions: [
          {
            key: PERMISSIONS.PAYSLIP_READ_ALL,
            scopeType: "TENANT",
            scopeId: null,
            validTo: null,
          },
        ],
        roles: [{ key: "finance", scopeType: "TENANT", scopeId: null }],
        teamMemberships: [],
        reporting: { managerIds: [], reportIds: [] },
        accessGroupIds: [],
        policyVersion: 1,
        builtAt: Date.now(),
      };

      const decision = authorize(financeContext, PERMISSIONS.PAYSLIP_READ_ALL, {
        tenantId: tenantB, // Cross-tenant negative boundary
        resourceType: "payslip",
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("TENANT_MISMATCH");
    });
  });
});
