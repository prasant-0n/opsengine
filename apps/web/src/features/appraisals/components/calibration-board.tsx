"use client";

import React, { useState } from "react";
import { Sliders, Award, TrendingUp, CheckCircle2 } from "lucide-react";

interface CalibrationBoardProps {
  cycles: any[];
  onCalibrate: (cycleId: string) => Promise<any>;
}

export function CalibrationBoard({ cycles, onCalibrate }: CalibrationBoardProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<string>(cycles[0]?.id || "");
  const [calibratedData, setCalibratedData] = useState<any | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const handleRunCalibration = async () => {
    if (!selectedCycleId) return;
    try {
      setCalibrating(true);
      const res = await onCalibrate(selectedCycleId);
      setCalibratedData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setCalibrating(false);
    }
  };

  const distribution = calibratedData?.distribution;

  return (
    <div className="space-y-6">
      {/* Top Controller */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 border border-border p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-blue-500" />
          <div>
            <span className="font-bold text-sm block">Select Appraisal Cycle for Calibration</span>
            <span className="text-xs text-muted-foreground">
              Harmonize 360-degree scores with bell-curve standard deviations and OKR alignment.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="bg-muted border border-input rounded-lg px-3 py-1.5 text-xs text-foreground font-semibold"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status})
              </option>
            ))}
          </select>
          <button
            onClick={handleRunCalibration}
            disabled={calibrating || !selectedCycleId}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
          >
            {calibrating ? "Calibrating..." : "Execute Calibration"}
          </button>
        </div>
      </div>

      {/* Bell-Curve Distribution Display */}
      {distribution && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3 text-center">
            {[
              { label: "Band 1: Unsatisfactory", pct: distribution.band1_unsatisfactory, color: "bg-rose-500" },
              { label: "Band 2: Needs Imprv.", pct: distribution.band2_needs_improvement, color: "bg-amber-500" },
              { label: "Band 3: Meets Expect.", pct: distribution.band3_meets, color: "bg-emerald-500" },
              { label: "Band 4: Exceeds", pct: distribution.band4_exceeds, color: "bg-blue-500" },
              { label: "Band 5: Exceptional", pct: distribution.band5_exceptional, color: "bg-indigo-500" },
            ].map((band, idx) => (
              <div key={idx} className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-[10px] text-muted-foreground block font-medium truncate">
                  {band.label}
                </span>
                <span className="text-xl font-mono font-bold text-foreground">{band.pct}%</span>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${band.color}`} style={{ width: `${band.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Calibrated Employees List */}
          <div className="border border-border rounded-xl overflow-hidden bg-card text-xs">
            <div className="p-3 bg-muted/50 border-b border-border font-bold">
              Calibrated Employee Composite Results ({calibratedData.calibratedEmployeesCount})
            </div>
            <div className="divide-y divide-border">
              {calibratedData.employeeCalibrations?.map((emp: any) => (
                <div key={emp.employeeId} className="p-3 flex justify-between items-center hover:bg-muted/30 transition">
                  <div>
                    <span className="font-mono text-xs font-bold text-foreground">
                      ID: {emp.employeeId.slice(0, 13)}...
                    </span>
                    <span className="text-muted-foreground block text-[11px]">
                      {emp.reviewsCount} reviews evaluated • OKR Normalized: {emp.breakdown?.okrScoreNormalized}/5.0
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <span className="font-bold text-sm font-mono text-emerald-500 block">
                        {emp.finalScore} / 5.0
                      </span>
                      <span className="text-[10px] text-muted-foreground">{emp.performanceBand}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!distribution && (
        <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          Select an active appraisal cycle and click &quot;Execute Calibration&quot; to aggregate 360-degree reviews into the corporate bell curve.
        </div>
      )}
    </div>
  );
}
