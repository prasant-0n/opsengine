"use client";

import React, { useState } from "react";
import { X, DollarSign } from "lucide-react";

interface SalaryStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  employees: Array<{ id: string; displayName: string; workEmail: string }>;
}

export function SalaryStructureModal({
  isOpen,
  onClose,
  onSubmit,
  employees,
}: SalaryStructureModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [basic, setBasic] = useState("5000");
  const [hra, setHra] = useState("2000");
  const [allowances, setAllowances] = useState("1000");
  const [pfEmployee, setPfEmployee] = useState("600");
  const [pfEmployer, setPfEmployer] = useState("600");
  const [taxTds, setTaxTds] = useState("800");
  const [bankName, setBankName] = useState("JPMorgan Chase");
  const [bankAccountNumber, setBankAccountNumber] = useState("9876543210");
  const [bankRoutingCode, setBankRoutingCode] = useState("021000021");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await onSubmit({
        employeeId,
        basicCents: Math.round(parseFloat(basic || "0") * 100),
        hraCents: Math.round(parseFloat(hra || "0") * 100),
        allowanceCents: Math.round(parseFloat(allowances || "0") * 100),
        pfEmployeeCents: Math.round(parseFloat(pfEmployee || "0") * 100),
        pfEmployerCents: Math.round(parseFloat(pfEmployer || "0") * 100),
        taxTdsCents: Math.round(parseFloat(taxTds || "0") * 100),
        paymentMethod: "bank_transfer",
        bankName,
        bankAccountNumber,
        bankRoutingCode,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save salary structure");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold">Configure Employee Salary Structure</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Select Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2 text-foreground"
              required
            >
              <option value="">-- Choose employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.displayName} ({emp.workEmail})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1">Basic ($/mo)</label>
              <input
                type="number"
                step="0.01"
                value={basic}
                onChange={(e) => setBasic(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">HRA ($/mo)</label>
              <input
                type="number"
                step="0.01"
                value={hra}
                onChange={(e) => setHra(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Allowances ($/mo)</label>
              <input
                type="number"
                step="0.01"
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1">PF Employee ($)</label>
              <input
                type="number"
                step="0.01"
                value={pfEmployee}
                onChange={(e) => setPfEmployee(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">PF Employer ($)</label>
              <input
                type="number"
                step="0.01"
                value={pfEmployer}
                onChange={(e) => setPfEmployer(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Tax TDS ($)</label>
              <input
                type="number"
                step="0.01"
                value={taxTds}
                onChange={(e) => setTaxTds(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            <div>
              <label className="font-semibold block mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Account Number</label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Routing Code</label>
              <input
                type="text"
                value={bankRoutingCode}
                onChange={(e) => setBankRoutingCode(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Salary Structure"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
