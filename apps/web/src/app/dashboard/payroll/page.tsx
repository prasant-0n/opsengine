"use client";

import React, { useState, useEffect } from "react";
import {
  PayrollDashboard,
  PayslipViewerModal,
  SalaryStructureModal,
  PayrollRunModal,
} from "@/features/payroll";

export default function PayrollDashboardPage() {
  const [currentTab, setCurrentTab] = useState<"my-payslips" | "runs" | "structures">("my-payslips");
  const [myPayslips, setMyPayslips] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [canManagePayroll, setCanManagePayroll] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load my payslips
      const payslipsRes = await fetch("/api/payroll/payslips");
      if (payslipsRes.ok) {
        const json = await payslipsRes.json();
        setMyPayslips(json.data || []);
      }

      // Check if user has access to runs
      const runsRes = await fetch("/api/payroll/runs");
      if (runsRes.ok) {
        const json = await runsRes.json();
        setRuns(json.data || []);
        setCanManagePayroll(true);

        // Load structures and employees
        const [structRes, empRes] = await Promise.all([
          fetch("/api/payroll/structures"),
          fetch("/api/org/employees?limit=100"),
        ]);
        if (structRes.ok) {
          const structJson = await structRes.json();
          setStructures(structJson.data || []);
        }
        if (empRes.ok) {
          const empJson = await empRes.json();
          setEmployees(empJson.data || []);
        }
      } else {
        setCanManagePayroll(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPayslip = async (payslip: any) => {
    try {
      const res = await fetch(`/api/payroll/payslips/${payslip.id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedPayslip(json.data);
      } else {
        setSelectedPayslip(payslip);
      }
    } catch {
      setSelectedPayslip(payslip);
    }
  };

  const handleOpenRun = async (run: any) => {
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedRun(json.data);
      } else {
        setSelectedRun(run);
      }
    } catch {
      setSelectedRun(run);
    }
  };

  const handleCreateNewRun = async () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const res = await fetch("/api/payroll/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to create payroll run");
      return;
    }

    await loadData();
    const json = await res.json();
    await handleOpenRun(json.data);
  };

  const handleCalculateRun = async (id: string) => {
    const res = await fetch(`/api/payroll/runs/${id}/calculate`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Calculation failed");
    }
    const json = await res.json();
    await handleOpenRun(json.data);
    await loadData();
    return json.data;
  };

  const handleApproveRun = async (id: string) => {
    const res = await fetch(`/api/payroll/runs/${id}/approve`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Approval failed");
    }
    const json = await res.json();
    await handleOpenRun(json.data);
    await loadData();
    return json.data;
  };

  const handleDisburseRun = async (id: string) => {
    const res = await fetch(`/api/payroll/runs/${id}/disburse`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Disbursement failed");
    }
    const json = await res.json();
    await handleOpenRun(json.data);
    await loadData();
    return json.data;
  };

  const handleSaveStructure = async (formData: any) => {
    const res = await fetch("/api/payroll/structures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save salary structure");
    }
    await loadData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <span>Loading statutory payroll records...</span>
        </div>
      )}

      <PayrollDashboard
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        myPayslips={myPayslips}
        runs={runs}
        structures={structures}
        canManagePayroll={canManagePayroll}
        onOpenPayslip={handleOpenPayslip}
        onOpenRun={handleOpenRun}
        onOpenNewRun={handleCreateNewRun}
        onOpenNewStructure={() => setIsStructureModalOpen(true)}
      />

      <PayslipViewerModal
        payslip={selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
      />

      <PayrollRunModal
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
        onCalculate={handleCalculateRun}
        onApprove={handleApproveRun}
        onDisburse={handleDisburseRun}
        onOpenPayslip={handleOpenPayslip}
      />

      <SalaryStructureModal
        isOpen={isStructureModalOpen}
        onClose={() => setIsStructureModalOpen(false)}
        onSubmit={handleSaveStructure}
        employees={employees}
      />
    </div>
  );
}
