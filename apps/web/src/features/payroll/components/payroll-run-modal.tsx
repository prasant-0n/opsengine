"use client";

import React, { useState } from "react";
import { X, Calculator, CheckCircle2, Send, Download, AlertCircle, FileText } from "lucide-react";
import { formatCentsToAmount } from "../lib/payroll-engine";

interface PayrollRunModalProps {
  run: any | null;
  onClose: () => void;
  onCalculate: (id: string) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onDisburse: (id: string) => Promise<void>;
  onOpenPayslip: (payslip: any) => void;
}

export function PayrollRunModal({
  run,
  onClose,
  onCalculate,
  onApprove,
  onDisburse,
  onOpenPayslip,
}: PayrollRunModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchExportText, setBatchExportText] = useState<string | null>(null);

  if (!run) return null;

  const handleAction = async (fn: (id: string) => Promise<any>) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fn(run.id);
      if (res?.bankBatchContent) {
        setBatchExportText(res.bankBatchContent);
      }
    } catch (err: any) {
      setError(err.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadBatchFile = () => {
    if (!batchExportText) return;
    const blob = new Blob([batchExportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ACH_${run.runNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">Payroll Run {run.runNumber}</h3>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {run.status?.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cycle: {run.periodYear}-{String(run.periodMonth).padStart(2, "0")} • {run.totalEmployees} Employees Processed
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-muted/30 border border-border rounded-lg text-xs">
            <span className="text-muted-foreground block">Total Gross Wages</span>
            <span className="text-lg font-mono font-bold text-foreground">
              {formatCentsToAmount(run.totalGrossCents)}
            </span>
          </div>
          <div className="p-4 bg-muted/30 border border-border rounded-lg text-xs">
            <span className="text-muted-foreground block">Statutory Deductions & LOP</span>
            <span className="text-lg font-mono font-bold text-rose-500">
              {formatCentsToAmount(run.totalDeductionsCents)}
            </span>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 block font-semibold">Net Disbursable</span>
            <span className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {formatCentsToAmount(run.totalNetCents)}
            </span>
          </div>
        </div>

        {/* Batch Export Banner if Disbursed */}
        {(batchExportText || run.batchExportRef) && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="font-semibold text-blue-500 block">Bank Direct Deposit Batch File Ready</span>
              <span className="text-muted-foreground block font-mono text-[11px]">
                Ref: {run.batchExportRef || "Generated"}
              </span>
            </div>
            {batchExportText && (
              <button
                onClick={downloadBatchFile}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download NACHA/ACH File
              </button>
            )}
          </div>
        )}

        {/* Payslips Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Processed Employee Payslips ({run.payslips?.length || 0})
          </h4>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-2.5">Payslip #</th>
                  <th className="p-2.5">Employee</th>
                  <th className="p-2.5 text-right">Gross</th>
                  <th className="p-2.5 text-right">Deductions</th>
                  <th className="p-2.5 text-right">Net Pay</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {run.payslips?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition">
                    <td className="p-2.5 font-mono font-medium">{p.payslipNumber}</td>
                    <td className="p-2.5">
                      <span className="font-semibold block">{p.employee?.displayName || "Employee"}</span>
                      <span className="text-[10px] text-muted-foreground">{p.employee?.workEmail}</span>
                    </td>
                    <td className="p-2.5 text-right font-mono">{formatCentsToAmount(p.grossPayCents)}</td>
                    <td className="p-2.5 text-right font-mono text-rose-500">
                      {formatCentsToAmount(p.totalDeductionsCents)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-500">
                      {formatCentsToAmount(p.netPayCents)}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => onOpenPayslip(p)}
                        className="text-blue-500 hover:underline font-semibold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!run.payslips?.length && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No payslips calculated yet. Click &quot;Calculate Payslips&quot; to process this run.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Lifecycle Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {run.status === "draft" && "Run is in draft. Run calculations to generate itemized payslips."}
            {run.status === "calculated" && "Calculated. Review figures and submit for distinct finance approval."}
            {run.status === "approved" && "Approved. Ready for bank disbursement and employee portal publication."}
            {run.status === "disbursed" && "Run completed and disbursed. All records are locked."}
          </div>

          <div className="flex gap-2">
            {run.status === "draft" && (
              <button
                disabled={loading}
                onClick={() => handleAction(onCalculate)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Calculator className="w-3.5 h-3.5" />
                {loading ? "Processing..." : "Calculate Payslips"}
              </button>
            )}

            {run.status === "calculated" && (
              <>
                <button
                  disabled={loading}
                  onClick={() => handleAction(onCalculate)}
                  className="px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-semibold transition"
                >
                  Recalculate
                </button>
                <button
                  disabled={loading}
                  onClick={() => handleAction(onApprove)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {loading ? "Approving..." : "Approve Run (SoD)"}
                </button>
              </>
            )}

            {run.status === "approved" && (
              <button
                disabled={loading}
                onClick={() => handleAction(onDisburse)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {loading ? "Disbursing..." : "Disburse & Generate ACH"}
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
