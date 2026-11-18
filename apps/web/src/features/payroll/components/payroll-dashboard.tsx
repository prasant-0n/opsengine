"use client";

import React, { useState } from "react";
import {
  FileText,
  DollarSign,
  Calendar,
  Building2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
} from "lucide-react";
import { formatCentsToAmount } from "../lib/payroll-engine";

interface PayrollDashboardProps {
  currentTab: "my-payslips" | "runs" | "structures";
  onTabChange: (tab: "my-payslips" | "runs" | "structures") => void;
  myPayslips: any[];
  runs: any[];
  structures: any[];
  canManagePayroll: boolean;
  onOpenPayslip: (payslip: any) => void;
  onOpenRun: (run: any) => void;
  onOpenNewRun: () => void;
  onOpenNewStructure: () => void;
}

export function PayrollDashboard({
  currentTab,
  onTabChange,
  myPayslips,
  runs,
  structures,
  canManagePayroll,
  onOpenPayslip,
  onOpenRun,
  onOpenNewRun,
  onOpenNewStructure,
}: PayrollDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Statutory Payroll & Payslips</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated salary calculations, attendance-linked LOP deductions, cryptographic SHA-256 payslips, and ACH banking exports.
          </p>
        </div>
        {canManagePayroll && (
          <div className="flex gap-2">
            <button
              onClick={onOpenNewStructure}
              className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Configure Salary
            </button>
            <button
              onClick={onOpenNewRun}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Payroll Run
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => onTabChange("my-payslips")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === "my-payslips"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          My Payslips ({myPayslips.length})
        </button>
        {canManagePayroll && (
          <>
            <button
              onClick={() => onTabChange("runs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentTab === "runs"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Payroll Runs ({runs.length})
            </button>
            <button
              onClick={() => onTabChange("structures")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                currentTab === "structures"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Salary Structures ({structures.length})
            </button>
          </>
        )}
      </div>

      {/* Tab: My Payslips */}
      {currentTab === "my-payslips" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Payslip #</th>
                <th className="p-3">Period</th>
                <th className="p-3 text-right">Gross Earnings</th>
                <th className="p-3 text-right">Deductions</th>
                <th className="p-3 text-right">Net Take-Home</th>
                <th className="p-3 text-center">Integrity</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {myPayslips.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition">
                  <td className="p-3 font-mono font-medium">{p.payslipNumber}</td>
                  <td className="p-3 font-medium">
                    {p.periodYear}-{String(p.periodMonth).padStart(2, "0")}
                  </td>
                  <td className="p-3 text-right font-mono">{formatCentsToAmount(p.grossPayCents)}</td>
                  <td className="p-3 text-right font-mono text-rose-500">
                    {formatCentsToAmount(p.totalDeductionsCents)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-500">
                    {formatCentsToAmount(p.netPayCents)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      SHA-256
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {p.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onOpenPayslip(p)}
                      className="text-blue-500 hover:underline font-semibold"
                    >
                      View Slip
                    </button>
                  </td>
                </tr>
              ))}
              {!myPayslips.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No published payslips found for your employee profile.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Payroll Runs (Finance) */}
      {currentTab === "runs" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Run #</th>
                <th className="p-3">Cycle</th>
                <th className="p-3 text-center">Employees</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Deductions</th>
                <th className="p-3 text-right">Net Disbursable</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition">
                  <td className="p-3 font-mono font-medium">{r.runNumber}</td>
                  <td className="p-3 font-medium">
                    {r.periodYear}-{String(r.periodMonth).padStart(2, "0")}
                  </td>
                  <td className="p-3 text-center">{r.totalEmployees}</td>
                  <td className="p-3 text-right font-mono">{formatCentsToAmount(r.totalGrossCents)}</td>
                  <td className="p-3 text-right font-mono text-rose-500">
                    {formatCentsToAmount(r.totalDeductionsCents)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-500">
                    {formatCentsToAmount(r.totalNetCents)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary">
                      {r.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onOpenRun(r)}
                      className="text-blue-500 hover:underline font-semibold"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No payroll runs found. Click &quot;New Payroll Run&quot; to initialize a monthly cycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Salary Structures */}
      {currentTab === "structures" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-right">Basic</th>
                <th className="p-3 text-right">HRA</th>
                <th className="p-3 text-right">Allowances</th>
                <th className="p-3 text-right">PF</th>
                <th className="p-3 text-right">Tax TDS</th>
                <th className="p-3">Bank Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {structures.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition">
                  <td className="p-3">
                    <span className="font-semibold block">{s.employee?.displayName || "Employee"}</span>
                    <span className="text-[10px] text-muted-foreground">{s.employee?.workEmail}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{s.employee?.department || "General"}</td>
                  <td className="p-3 text-right font-mono">{formatCentsToAmount(s.basicCents)}</td>
                  <td className="p-3 text-right font-mono">{formatCentsToAmount(s.hraCents)}</td>
                  <td className="p-3 text-right font-mono">{formatCentsToAmount(s.allowanceCents)}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground">
                    {formatCentsToAmount(s.pfEmployeeCents)}
                  </td>
                  <td className="p-3 text-right font-mono text-muted-foreground">
                    {formatCentsToAmount(s.taxTdsCents)}
                  </td>
                  <td className="p-3 font-mono text-[11px] text-muted-foreground">
                    {s.bankName || "Bank"} ••{s.bankAccountNumber?.slice(-4) || "0000"}
                  </td>
                </tr>
              ))}
              {!structures.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No active salary structures configured yet. Click &quot;Configure Salary&quot; to assign compensation packages.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
