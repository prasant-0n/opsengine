import crypto from "crypto";

export const PAYROLL_STATUSES = [
  "draft",
  "calculated",
  "approved",
  "disbursed",
  "cancelled",
] as const;

export type PayrollRunStatus = (typeof PAYROLL_STATUSES)[number];

export const PAYSLIP_STATUSES = [
  "draft",
  "generated",
  "published",
  "paid",
] as const;

export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

export interface SalaryInput {
  basicCents: bigint;
  hraCents: bigint;
  allowanceCents: bigint;
  pfEmployeeCents: bigint;
  pfEmployerCents: bigint;
  taxTdsCents: bigint;
}

export interface PayrollCalculationInput {
  salary: SalaryInput;
  workingDays: number; // e.g. 30
  workedDays: number;
  unpaidLeaveDays: number; // e.g. 2.0
}

export interface PayrollCalculationResult {
  grossPayCents: bigint;
  lopDeductionCents: bigint;
  pfEmployeeCents: bigint;
  pfEmployerCents: bigint;
  taxTdsCents: bigint;
  totalDeductionsCents: bigint;
  netPayCents: bigint;
}

/**
 * Calculates itemized gross pay, LOP deductions, statutory taxes, and net pay.
 * Operates purely on integer cents (BigInt) to eliminate floating-point drift.
 */
export function calculatePayslipAmounts(input: PayrollCalculationInput): PayrollCalculationResult {
  const { salary, workingDays, unpaidLeaveDays } = input;
  const safeWorkingDays = workingDays > 0 ? workingDays : 30;

  // Gross Pay = Basic + HRA + Allowances
  const grossPayCents = salary.basicCents + salary.hraCents + salary.allowanceCents;

  // Loss of Pay (LOP) deduction based on unpaid leave days
  let lopDeductionCents = 0n;
  if (unpaidLeaveDays > 0) {
    // Basic per-day rate computed in integer cents with high precision
    const leaveUnits = BigInt(Math.round(unpaidLeaveDays * 100));
    lopDeductionCents = (salary.basicCents * leaveUnits) / (BigInt(safeWorkingDays) * 100n);
  }

  // Statutory deductions
  const pfEmployeeCents = salary.pfEmployeeCents;
  const pfEmployerCents = salary.pfEmployerCents;
  const taxTdsCents = salary.taxTdsCents;

  const totalDeductionsCents = pfEmployeeCents + taxTdsCents + lopDeductionCents;

  // Net Pay = Gross Pay - Total Deductions (guaranteed non-negative)
  const netPayCents = grossPayCents > totalDeductionsCents ? grossPayCents - totalDeductionsCents : 0n;

  return {
    grossPayCents,
    lopDeductionCents,
    pfEmployeeCents,
    pfEmployerCents,
    taxTdsCents,
    totalDeductionsCents,
    netPayCents,
  };
}

/**
 * Generates a tamper-evident SHA-256 cryptographic checksum for a payslip record.
 */
export function generatePayslipChecksum(data: {
  tenantId: string;
  payrollRunId: string;
  employeeId: string;
  payslipNumber: string;
  periodYear: number;
  periodMonth: number;
  grossPayCents: bigint | string | number;
  totalDeductionsCents: bigint | string | number;
  netPayCents: bigint | string | number;
}): string {
  const canonicalPayload = [
    data.tenantId,
    data.payrollRunId,
    data.employeeId,
    data.payslipNumber,
    String(data.periodYear),
    String(data.periodMonth).padStart(2, "0"),
    String(data.grossPayCents),
    String(data.totalDeductionsCents),
    String(data.netPayCents),
  ].join("|");

  return crypto.createHash("sha256").update(canonicalPayload, "utf8").digest("hex");
}

/**
 * Validates the cryptographic checksum of a payslip to verify no tamper modification has occurred.
 */
export function verifyPayslipIntegrity(
  checksum: string,
  data: {
    tenantId: string;
    payrollRunId: string;
    employeeId: string;
    payslipNumber: string;
    periodYear: number;
    periodMonth: number;
    grossPayCents: bigint | string | number;
    totalDeductionsCents: bigint | string | number;
    netPayCents: bigint | string | number;
  }
): boolean {
  const expectedChecksum = generatePayslipChecksum(data);
  return checksum.toLowerCase() === expectedChecksum.toLowerCase();
}

/**
 * State machine for valid forward and backward payroll run lifecycle transitions.
 */
export function canTransitionPayrollRun(current: PayrollRunStatus, next: PayrollRunStatus): boolean {
  const allowedTransitions: Record<PayrollRunStatus, PayrollRunStatus[]> = {
    draft: ["calculated", "cancelled"],
    calculated: ["approved", "draft", "cancelled"],
    approved: ["disbursed", "calculated", "cancelled"],
    disbursed: [], // Final immutable state
    cancelled: [],
  };

  return allowedTransitions[current]?.includes(next) ?? false;
}

/**
 * Generates an automated NACHA ACH / NEFT standard bank transfer batch file.
 */
export function generateBankBatchExport(params: {
  runNumber: string;
  periodYear: number;
  periodMonth: number;
  records: Array<{
    payslipNumber: string;
    employeeName: string;
    employeeEmail: string;
    bankAccountNumber: string;
    bankRoutingCode: string;
    netPayCents: bigint;
    currency: string;
  }>;
}): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const lines: string[] = [];

  // File Header Record (ACH / Banking Batch Style)
  lines.push(`1,1000000000,OPSENGINE_PAYROLL,${params.runNumber},${dateStr},USD,BATCH_HEADER`);

  // Batch Detail Records
  params.records.forEach((rec, idx) => {
    const formattedAmount = (Number(rec.netPayCents) / 100).toFixed(2);
    const sanitizedName = rec.employeeName.replace(/,/g, " ").slice(0, 30);
    const account = rec.bankAccountNumber || "ACCT-UNKNOWN";
    const routing = rec.bankRoutingCode || "ROUTING-UNKNOWN";
    const sequence = String(idx + 1).padStart(6, "0");

    lines.push(
      `6,22,${routing},${account},${formattedAmount},${rec.payslipNumber},${sanitizedName},${sequence}`
    );
  });

  // Batch Control / Trailer Record
  const totalAmountCents = params.records.reduce((acc, r) => acc + r.netPayCents, 0n);
  const totalAmountFormatted = (Number(totalAmountCents) / 100).toFixed(2);
  lines.push(`9,${String(params.records.length).padStart(6, "0")},${totalAmountFormatted},OPSENGINE_BATCH_TRAILER`);

  return lines.join("\n");
}

/**
 * Formats integer cents to display amount with currency symbol.
 */
export function formatCentsToAmount(cents: bigint | number | string, currency = "USD"): string {
  const numeric = typeof cents === "bigint" ? Number(cents) : Number(cents) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric / 100);
}

export function isValidPayrollStatus(status: string): status is PayrollRunStatus {
  return (PAYROLL_STATUSES as readonly string[]).includes(status);
}

export function isValidPayslipStatus(status: string): status is PayslipStatus {
  return (PAYSLIP_STATUSES as readonly string[]).includes(status);
}
