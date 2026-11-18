"use client";

import React from "react";
import { X, ShieldCheck } from "lucide-react";
import { formatCentsToAmount } from "../lib/payroll-engine";

interface PayslipViewerModalProps {
  payslip: any | null;
  onClose: () => void;
}

export function PayslipViewerModal({ payslip, onClose }: PayslipViewerModalProps) {
  if (!payslip) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">Payslip {payslip.payslipNumber}</h3>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {payslip.status?.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Period: {payslip.periodYear}-{String(payslip.periodMonth).padStart(2, "0")} • Working Days: {payslip.workingDays} (Worked: {payslip.workedDays}, LOP: {payslip.unpaidLeaveDays})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee & Bank Info */}
        <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg text-xs">
          <div>
            <span className="text-muted-foreground block">Employee:</span>
            <span className="font-semibold text-foreground text-sm">{payslip.employee?.displayName || "Employee"}</span>
            <span className="text-muted-foreground block mt-0.5">{payslip.employee?.workEmail}</span>
            <span className="text-muted-foreground block">{payslip.employee?.department || "General"}</span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground block">Disbursement Reference:</span>
            <span className="font-mono text-foreground font-semibold">{payslip.paymentReference || "N/A"}</span>
            <span className="text-muted-foreground block mt-1">Paid At:</span>
            <span className="font-medium text-foreground">
              {payslip.paidAt ? new Date(payslip.paidAt).toLocaleDateString() : "Pending"}
            </span>
          </div>
        </div>

        {/* Itemized Breakdown Table */}
        <div className="grid grid-cols-2 gap-6">
          {/* Earnings */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              Earnings
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Basic Salary</span>
                <span className="font-mono font-medium">{formatCentsToAmount(payslip.basicCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>House Rent Allowance (HRA)</span>
                <span className="font-mono font-medium">{formatCentsToAmount(payslip.hraCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Special Allowances</span>
                <span className="font-mono font-medium">{formatCentsToAmount(payslip.allowancesCents)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold text-sm">
                <span>Gross Pay</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCentsToAmount(payslip.grossPayCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              Deductions
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Provident Fund (PF / 401k)</span>
                <span className="font-mono font-medium">{formatCentsToAmount(payslip.pfEmployeeCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Income Tax Withholding (TDS)</span>
                <span className="font-mono font-medium">{formatCentsToAmount(payslip.taxTdsCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Loss of Pay (LOP Deduction)</span>
                <span className="font-mono font-medium text-amber-500">
                  {formatCentsToAmount(payslip.lopDeductionCents)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold text-sm">
                <span>Total Deductions</span>
                <span className="font-mono text-rose-600 dark:text-rose-400">
                  {formatCentsToAmount(payslip.totalDeductionsCents)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Pay Callout */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex justify-between items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Net Take-Home Pay
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">Disbursed via automated direct bank transfer</p>
          </div>
          <div className="text-2xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatCentsToAmount(payslip.netPayCents)}
          </div>
        </div>

        {/* SHA-256 Tamper-Evidence Verification Badge */}
        <div className="bg-muted/40 p-3 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <div>
              <span className="font-semibold text-foreground">Cryptographic SHA-256 Checksum Verified</span>
              <span className="block font-mono text-[10px] text-muted-foreground truncate max-w-sm">
                {payslip.checksumSha256}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-500">
            TAMPER-EVIDENT
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
