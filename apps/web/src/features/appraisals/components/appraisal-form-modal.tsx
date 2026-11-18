"use client";

import React, { useState } from "react";
import { X, Award, AlertCircle } from "lucide-react";

interface AppraisalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  cycleId: string;
  employees: Array<{ id: string; displayName: string; workEmail: string }>;
  currentEmployeeId?: string;
}

export function AppraisalFormModal({
  isOpen,
  onClose,
  onSubmit,
  cycleId,
  employees,
  currentEmployeeId,
}: AppraisalFormModalProps) {
  const [employeeId, setEmployeeId] = useState(currentEmployeeId || "");
  const [reviewType, setReviewType] = useState<"self" | "manager" | "peer">("self");
  const [technical, setTechnical] = useState(4);
  const [delivery, setDelivery] = useState(4);
  const [collaboration, setCollaboration] = useState(4);
  const [ownership, setOwnership] = useState(4);
  const [leadership, setLeadership] = useState(3);
  const [strengths, setStrengths] = useState("");
  const [growthAreas, setGrowthAreas] = useState("");
  const [recommendation, setRecommendation] = useState("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError("Please select the employee being reviewed.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const competencyRatings = {
        technical,
        delivery,
        collaboration,
        ownership,
        leadership,
      };

      const avg = (technical + delivery + collaboration + ownership + leadership) / 5;

      await onSubmit({
        cycleId,
        employeeId,
        reviewType,
        competencyRatings,
        overallRating: Math.round(avg * 10) / 10,
        strengthsSummary: strengths,
        growthAreas,
        recommendation,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold">Submit 360 Performance Appraisal</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Review Type</label>
              <select
                value={reviewType}
                onChange={(e) => setReviewType(e.target.value as any)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2 text-foreground"
              >
                <option value="self">Self Evaluation</option>
                <option value="manager">Manager Evaluation</option>
                <option value="peer">Peer Review</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Subject Employee</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2 text-foreground"
                required
              >
                <option value="">-- Select employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.displayName} ({emp.workEmail})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Competency Rubrics */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
              Competency Rubrics (1 - 5 Scale)
            </h4>

            {[
              { label: "Technical & Domain Excellence", val: technical, set: setTechnical },
              { label: "Delivery Speed & Quality", val: delivery, set: setDelivery },
              { label: "Team Collaboration & Culture", val: collaboration, set: setCollaboration },
              { label: "Ownership & Accountability", val: ownership, set: setOwnership },
              { label: "Leadership & Initiative", val: leadership, set: setLeadership },
            ].map((comp, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="font-medium text-foreground">{comp.label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={comp.val}
                    onChange={(e) => comp.set(parseInt(e.target.value, 10))}
                    className="w-24 accent-blue-600 cursor-pointer"
                  />
                  <span className="font-mono font-bold w-4 text-center">{comp.val}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Qualitative Inputs */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <label className="font-semibold block mb-1">Demonstrated Strengths & Highlights</label>
              <textarea
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                rows={2}
                placeholder="Key accomplishments, high impact deliverables, and mentoring contributions..."
                className="w-full bg-muted/40 border border-input rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Opportunities for Growth</label>
              <textarea
                value={growthAreas}
                onChange={(e) => setGrowthAreas(e.target.value)}
                rows={2}
                placeholder="Skills to develop, architectural areas to deepen, or execution velocity improvements..."
                className="w-full bg-muted/40 border border-input rounded-lg p-2.5"
              />
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="font-semibold block mb-1">Cycle Recommendation</label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full bg-muted/40 border border-input rounded-lg px-3 py-2 text-foreground"
            >
              <option value="none">Standard Progression / No Action</option>
              <option value="promotion">Recommend for Promotion</option>
              <option value="compensation_increase">Recommend for Merit Increase</option>
              <option value="pip">Performance Improvement Plan (PIP)</option>
            </select>
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
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
