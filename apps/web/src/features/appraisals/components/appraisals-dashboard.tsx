"use client";

import React from "react";
import { Plus, Star } from "lucide-react";
import { OkrTracker } from "./okr-tracker";
import { CalibrationBoard } from "./calibration-board";

interface AppraisalsDashboardProps {
  currentTab: "okrs" | "cycles" | "reviews" | "calibration";
  onTabChange: (tab: "okrs" | "cycles" | "reviews" | "calibration") => void;
  objectives: any[];
  cycles: any[];
  reviews: any[];
  canManageOkrs: boolean;
  canManageCycles: boolean;
  canCalibrate: boolean;
  onOpenNewObjective: () => void;
  onOpenNewCycle: () => void;
  onOpenReviewModal: () => void;
  onCalibrate: (cycleId: string) => Promise<any>;
}

export function AppraisalsDashboard({
  currentTab,
  onTabChange,
  objectives,
  cycles,
  reviews,
  canManageOkrs,
  canManageCycles,
  canCalibrate,
  onOpenNewObjective,
  onOpenNewCycle,
  onOpenReviewModal,
  onCalibrate,
}: AppraisalsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Performance Management & OKRs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Objectives & Key Results tracking, 360-degree performance appraisals, and bell-curve rating calibrations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenReviewModal}
            className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Star className="w-3.5 h-3.5" />
            Submit 360 Review
          </button>
          {canManageCycles && (
            <button
              onClick={onOpenNewCycle}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Cycle
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => onTabChange("okrs")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === "okrs"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          OKRs & Goals ({objectives.length})
        </button>
        <button
          onClick={() => onTabChange("reviews")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === "reviews"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          360 Reviews ({reviews.length})
        </button>
        <button
          onClick={() => onTabChange("cycles")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === "cycles"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Appraisal Cycles ({cycles.length})
        </button>
        {canCalibrate && (
          <button
            onClick={() => onTabChange("calibration")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentTab === "calibration"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Calibration Matrix
          </button>
        )}
      </div>

      {/* Tab: OKRs */}
      {currentTab === "okrs" && (
        <OkrTracker
          objectives={objectives}
          canManageOkrs={canManageOkrs}
          onOpenNewObjective={onOpenNewObjective}
        />
      )}

      {/* Tab: 360 Reviews */}
      {currentTab === "reviews" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card text-xs">
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Reviewer</th>
                <th className="p-3 text-center">Type</th>
                <th className="p-3 text-right">Rating</th>
                <th className="p-3">Recommendation</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviews.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition">
                  <td className="p-3">
                    <span className="font-semibold block">{r.employee?.displayName || "Employee"}</span>
                    <span className="text-[10px] text-muted-foreground">{r.employee?.workEmail}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-medium block">{r.reviewer?.displayName || "Reviewer"}</span>
                    <span className="text-[10px] text-muted-foreground">{r.reviewer?.workEmail}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary capitalize">
                      {r.reviewType}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-amber-500">
                    {r.overallRating} / 5.0
                  </td>
                  <td className="p-3 capitalize font-medium text-foreground">
                    {r.recommendation?.replace(/_/g, " ")}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!reviews.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No appraisal reviews submitted yet. Click &quot;Submit 360 Review&quot; to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Cycles */}
      {currentTab === "cycles" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card text-xs">
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Cycle Name</th>
                <th className="p-3">Period</th>
                <th className="p-3">Self Review Deadline</th>
                <th className="p-3">Manager Deadline</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cycles.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition">
                  <td className="p-3 font-semibold">{c.name}</td>
                  <td className="p-3 text-muted-foreground font-mono">
                    {c.periodYear} {c.periodQuarter ? `Q${c.periodQuarter}` : "Annual"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(c.selfReviewDeadline).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(c.managerReviewDeadline).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500">
                      {c.status?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {!cycles.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No active appraisal cycles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Calibration */}
      {currentTab === "calibration" && (
        <CalibrationBoard cycles={cycles} onCalibrate={onCalibrate} />
      )}
    </div>
  );
}
