"use client";

import React, { useState } from "react";
import { X, CheckCircle2, XCircle, DollarSign, AlertTriangle, ShieldCheck, FileText } from "lucide-react";

interface DetailModalProps {
  report: any | null;
  onClose: () => void;
  onApproveManager: (id: string) => Promise<void>;
  onApproveFinance: (id: string) => Promise<void>;
  onPayout: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}

export function ExpenseDetailModal({
  report,
  onClose,
  onApproveManager,
  onApproveFinance,
  onPayout,
  onReject,
}: DetailModalProps) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!report) return null;

  const handleAction = async (actionFn: () => Promise<void>) => {
    setSubmitting(true);
    try {
      await actionFn();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to perform approval action");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await onReject(report.id, rejectReason);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to reject report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex justify-between items-start pr-8">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  report.status === "paid"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : report.status === "finance_approved"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : report.status === "manager_approved"
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                    : report.status === "rejected"
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {report.status.replace("_", " ")}
              </span>
              {report.voucherNumber && (
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {report.voucherNumber}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold mt-2 text-foreground">{report.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submitted by <strong>{report.submitter?.displayName || "Employee"}</strong> on{" "}
              {new Date(report.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Total Claim</span>
            <p className="text-2xl font-bold text-foreground">{report.totalAmountFormatted}</p>
          </div>
        </div>

        {report.rejectionReason && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg text-xs">
            <strong>Rejection Reason:</strong> {report.rejectionReason}
          </div>
        )}

        {/* Line Items List */}
        <div className="mt-5 flex-1 overflow-y-auto space-y-3 pr-1">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Itemized Expenditures ({report.items?.length || 0})
          </h4>
          <div className="divide-y divide-border border rounded-xl overflow-hidden">
            {report.items?.map((it: any) => (
              <div key={it.id} className="p-3 bg-card flex justify-between items-center text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{it.description}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                      {it.category}
                    </span>
                  </div>
                  {it.policyViolation && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {it.violationReason}
                    </p>
                  )}
                  {it.receipt && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {it.receipt.fileName} (SHA-256 verified)
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-foreground">{it.amountFormatted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {report.status === "submitted" && "Pending Stage-1 Manager Approval"}
            {report.status === "manager_approved" && "Pending Stage-2 Finance Verification"}
            {report.status === "finance_approved" && "Authorized for Reimbursement Disbursement"}
            {report.status === "paid" && "Disbursed & Reconciled"}
          </div>

          <div className="flex items-center gap-2">
            {!rejectMode ? (
              <>
                {(report.status === "submitted" || report.status === "manager_approved") && (
                  <button
                    onClick={() => setRejectMode(true)}
                    className="px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs font-semibold transition"
                  >
                    Reject Claim
                  </button>
                )}

                {report.status === "submitted" && (
                  <button
                    disabled={submitting}
                    onClick={() => handleAction(() => onApproveManager(report.id))}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve (Manager)
                  </button>
                )}

                {report.status === "manager_approved" && (
                  <button
                    disabled={submitting}
                    onClick={() => handleAction(() => onApproveFinance(report.id))}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Authorize (Finance)
                  </button>
                )}

                {report.status === "finance_approved" && (
                  <button
                    disabled={submitting}
                    onClick={() => handleAction(() => onPayout(report.id))}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <DollarSign className="w-4 h-4" />
                    Disburse Payout
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={handleRejectSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="px-3 py-1.5 bg-background border rounded-lg text-xs w-48 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
                >
                  Confirm Reject
                </button>
                <button
                  type="button"
                  onClick={() => setRejectMode(false)}
                  className="px-2 py-1.5 border rounded-lg text-xs hover:bg-muted transition"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
