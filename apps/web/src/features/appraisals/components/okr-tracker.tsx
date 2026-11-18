"use client";

import React, { useState } from "react";
import { Target, Plus, ChevronDown, ChevronRight } from "lucide-react";

interface OkrTrackerProps {
  objectives: any[];
  canManageOkrs: boolean;
  onOpenNewObjective: () => void;
}

export function OkrTracker({ objectives, canManageOkrs, onOpenNewObjective }: OkrTrackerProps) {
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(objectives.map((o) => o.id)));

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const filtered = objectives.filter((o) => {
    if (filterLevel === "all") return true;
    return o.level === filterLevel;
  });

  return (
    <div className="space-y-4">
      {/* Level Filters & Action */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {["all", "company", "department", "individual"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                filterLevel === lvl
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {lvl} OKRs
            </button>
          ))}
        </div>
        {canManageOkrs && (
          <button
            onClick={onOpenNewObjective}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Objective
          </button>
        )}
      </div>

      {/* Objectives Tree View */}
      <div className="space-y-3">
        {filtered.map((obj) => {
          const isExpanded = expandedIds.has(obj.id);
          const progressColor =
            obj.progressPercent >= 70
              ? "bg-emerald-500"
              : obj.progressPercent >= 40
              ? "bg-blue-500"
              : "bg-amber-500";

          return (
            <div key={obj.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
              {/* Objective Header */}
              <div
                onClick={() => toggleExpand(obj.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition"
              >
                <div className="flex items-center gap-3">
                  <button className="text-muted-foreground p-0.5">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm tracking-tight">{obj.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary capitalize">
                        {obj.level}
                      </span>
                      {obj.department && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                          {obj.department}
                        </span>
                      )}
                    </div>
                    {obj.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{obj.description}</p>
                    )}
                  </div>
                </div>

                {/* Progress Metric */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-foreground">
                      {Math.round(obj.progressPercent)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Progress</span>
                  </div>
                  <div className="w-28 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, obj.progressPercent))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Key Results Child List */}
              {isExpanded && obj.keyResults?.length > 0 && (
                <div className="px-6 pb-4 pt-1 border-t border-border/50 bg-muted/10 divide-y divide-border/40">
                  {obj.keyResults.map((kr: any) => {
                    const krProgress =
                      kr.targetValue > 0
                        ? Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100))
                        : 0;

                    return (
                      <div key={kr.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 max-w-lg">
                          <Target className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium text-foreground">{kr.title}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {kr.currentValue} / {kr.targetValue} {kr.unit}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-semibold text-[10px]">
                            {krProgress}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!filtered.length && (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No objectives found matching the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
