"use client";

import React, { useState } from "react";
import { MessageSquare, ShieldCheck, BarChart3, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { SurveyData } from "./survey-response-modal";

interface SurveysListProps {
  surveys: SurveyData[];
  onOpenSurvey: (survey: SurveyData) => void;
  onOpenAnalytics: (surveyId: string) => void;
  canViewAnalytics?: boolean;
}

export function SurveysList({
  surveys,
  onOpenSurvey,
  onOpenAnalytics,
  canViewAnalytics = true,
}: SurveysListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = ["all", "pulse", "enps", "onboarding", "exit", "general"];

  const filtered = surveys.filter(
    (s) => selectedCategory === "all" || s.category.toLowerCase() === selectedCategory
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              selectedCategory === cat
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-base font-medium text-slate-300">No active surveys in this category</h3>
          <p className="text-xs text-slate-500 mt-1">Check back later when HR launches new pulse feedback cycles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((survey) => (
            <div
              key={survey.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs capitalize px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 font-semibold">
                    {survey.category}
                  </span>
                  {survey.isAnonymous && (
                    <span className="text-xs flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
                      <ShieldCheck className="h-3 w-3" /> Anonymous
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-slate-100 mb-1">{survey.title}</h3>
                {survey.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{survey.description}</p>
                )}
                <div className="text-[11px] text-slate-500 mt-3">
                  {survey.questions?.length || 0} Questions
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => onOpenSurvey(survey)}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Participate</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {canViewAnalytics && (
                  <button
                    onClick={() => onOpenAnalytics(survey.id)}
                    className="py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Analytics</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
