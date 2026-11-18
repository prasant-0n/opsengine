"use client";

import React, { useState, useEffect } from "react";
import {
  AppraisalsDashboard,
  AppraisalFormModal,
} from "@/features/appraisals";

export default function AppraisalsDashboardPage() {
  const [currentTab, setCurrentTab] = useState<"okrs" | "cycles" | "reviews" | "calibration">("okrs");
  const [objectives, setObjectives] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [canManageOkrs, setCanManageOkrs] = useState(false);
  const [canManageCycles, setCanManageCycles] = useState(false);
  const [canCalibrate, setCanCalibrate] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      const [okrsRes, cyclesRes, reviewsRes, empRes] = await Promise.all([
        fetch("/api/appraisals/okrs"),
        fetch("/api/appraisals/cycles"),
        fetch("/api/appraisals/reviews"),
        fetch("/api/org/employees?limit=100"),
      ]);

      if (okrsRes.ok) {
        const json = await okrsRes.json();
        setObjectives(json.data || []);
        setCanManageOkrs(true);
      }
      if (cyclesRes.ok) {
        const json = await cyclesRes.json();
        setCycles(json.data || []);
        setCanManageCycles(true);
        setCanCalibrate(true);
      }
      if (reviewsRes.ok) {
        const json = await reviewsRes.json();
        setReviews(json.data || []);
      }
      if (empRes.ok) {
        const json = await empRes.json();
        setEmployees(json.data || []);
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

  const handleCreateObjective = async () => {
    const title = prompt("Enter OKR Objective Title:");
    if (!title) return;

    const res = await fetch("/api/appraisals/okrs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        level: "company",
        periodYear: new Date().getUTCFullYear(),
        periodQuarter: Math.floor(new Date().getUTCMonth() / 3) + 1,
        keyResults: [
          { title: "Complete Phase 1 Architecture Milestones", targetValue: 100, unit: "%" },
          { title: "Maintain 99.99% Availability & Sub-100ms Latency", targetValue: 100, unit: "%" },
        ],
      }),
    });

    if (res.ok) {
      await loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to create OKR");
    }
  };

  const handleCreateCycle = async () => {
    const name = prompt("Enter Appraisal Cycle Name (e.g. 2026 Annual Review):");
    if (!name) return;

    const res = await fetch("/api/appraisals/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        periodYear: new Date().getUTCFullYear(),
      }),
    });

    if (res.ok) {
      await loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to create cycle");
    }
  };

  const handleSubmitReview = async (formData: any) => {
    const res = await fetch("/api/appraisals/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Review submission failed");
    }

    await loadData();
  };

  const handleCalibrateCycle = async (cycleId: string) => {
    const res = await fetch("/api/appraisals/calibrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Calibration failed");
    }

    const json = await res.json();
    await loadData();
    return json.data;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <span>Loading performance appraisal & OKR records...</span>
        </div>
      )}

      <AppraisalsDashboard
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        objectives={objectives}
        cycles={cycles}
        reviews={reviews}
        canManageOkrs={canManageOkrs}
        canManageCycles={canManageCycles}
        canCalibrate={canCalibrate}
        onOpenNewObjective={handleCreateObjective}
        onOpenNewCycle={handleCreateCycle}
        onOpenReviewModal={() => setIsReviewModalOpen(true)}
        onCalibrate={handleCalibrateCycle}
      />

      <AppraisalFormModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmit={handleSubmitReview}
        cycleId={cycles[0]?.id || ""}
        employees={employees}
      />
    </div>
  );
}
