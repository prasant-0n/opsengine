"use client";

import React, { useState } from "react";
import { Plus, Receipt, Clock, CheckCircle2, DollarSign } from "lucide-react";

interface ExpenseListProps {
  reports: any[];
  currentView: "self" | "team" | "finance";
  onViewChange: (view: "self" | "team" | "finance") => void;
  onOpenReport: (report: any) => void;
  onOpenNewClaim: () => void;
  canViewTeam?: boolean;
  canViewFinance?: boolean;
}

export function ExpenseList({
  reports,
  currentView,
  onViewChange,
  onOpenReport,
  onOpenNewClaim,
  canViewTeam = true,
  canViewFinance = true,
}: ExpenseListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = reports.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  const pendingCount = reports.filter(
    (r) => r.status === "submitted" || r.status === "manager_approved"
  ).length;
  const approvedCount = reports.filter((r) => r.status === "finance_approved").length;
  const paidCount = reports.filter((r) => r.status === "paid").length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expense Management & Reimbursements</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit business claims, upload verified receipts, and track multi-stage approval disbursements.
          </p>
        </div>
        <button
          onClick={onOpenNewClaim}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          New Expense Claim
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-card border rounded-xl flex justify-between items-center shadow-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Pending In Review</p>
            <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-500">{pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manager & Finance stages</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-card border rounded-xl flex justify-between items-center shadow-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Ready for Payout</p>
            <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-500">{approvedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Finance authorized</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-card border rounded-xl flex justify-between items-center shadow-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Settled & Reimbursed</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-500">{paidCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Voucher generated</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* View Switcher & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
          <button
            onClick={() => onViewChange("self")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentView === "self" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Claims
          </button>
          {canViewTeam && (
            <button
              onClick={() => onViewChange("team")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentView === "team" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Team Approvals
            </button>
          )}
          {canViewFinance && (
            <button
              onClick={() => onViewChange("finance")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentView === "finance" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Finance Queue
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {["all", "submitted", "manager_approved", "finance_approved", "paid"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition ${
                statusFilter === st ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h4 className="font-semibold text-base">No expense reports found</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              You do not have any expense claims matching this filter.
            </p>
            <button
              onClick={onOpenNewClaim}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
            >
              Create Expense Claim
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground border-b uppercase">
                <tr>
                  <th className="py-3 px-4">Report Title</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onOpenReport(r)}
                    className="hover:bg-muted/30 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-medium text-foreground">
                      <p>{r.title}</p>
                      {r.voucherNumber && (
                        <p className="text-[10px] font-mono text-muted-foreground">{r.voucherNumber}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {r.employee?.displayName || "Self"}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {r.totalAmountFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          r.status === "paid"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : r.status === "finance_approved"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : r.status === "manager_approved"
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            : r.status === "rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReport(r);
                        }}
                        className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground rounded text-xs font-medium transition"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
