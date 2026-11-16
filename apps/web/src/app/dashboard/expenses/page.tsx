"use client";

import React, { useState, useEffect } from "react";
import {
  ExpenseList,
  ExpenseClaimModal,
  ExpenseDetailModal,
} from "@/features/expenses";

export default function ExpensesDashboardPage() {
  const [currentView, setCurrentView] = useState<"self" | "team" | "finance">("self");
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const loadReports = async (view = currentView) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/expenses/reports?view=${view}`);
      if (res.ok) {
        const json = await res.json();
        setReports(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(currentView);
  }, [currentView]);

  const handleOpenReport = async (report: any) => {
    try {
      const res = await fetch(`/api/expenses/reports/${report.id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedReport(json.data);
      } else {
        setSelectedReport(report);
      }
    } catch {
      setSelectedReport(report);
    }
  };

  const handleCreateClaim = async (data: any) => {
    const res = await fetch("/api/expenses/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to submit expense report");
    }
    await loadReports(currentView);
  };

  const handleApproveManager = async (id: string) => {
    const res = await fetch(`/api/expenses/reports/${id}/approve-manager`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to approve report");
    }
    await loadReports(currentView);
  };

  const handleApproveFinance = async (id: string) => {
    const res = await fetch(`/api/expenses/reports/${id}/approve-finance`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to approve report");
    }
    await loadReports(currentView);
  };

  const handlePayout = async (id: string) => {
    const res = await fetch(`/api/expenses/reports/${id}/payout`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to disburse payout");
    }
    await loadReports(currentView);
  };

  const handleReject = async (id: string, reason: string) => {
    const res = await fetch(`/api/expenses/reports/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to reject report");
    }
    await loadReports(currentView);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <span>Loading expense records...</span>
        </div>
      )}
      <ExpenseList
        reports={reports}
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenReport={handleOpenReport}
        onOpenNewClaim={() => setIsNewClaimOpen(true)}
      />

      <ExpenseClaimModal
        isOpen={isNewClaimOpen}
        onClose={() => setIsNewClaimOpen(false)}
        onSubmit={handleCreateClaim}
      />

      <ExpenseDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onApproveManager={handleApproveManager}
        onApproveFinance={handleApproveFinance}
        onPayout={handlePayout}
        onReject={handleReject}
      />
    </div>
  );
}
