"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, Users, Award, ShieldCheck, BarChart3, ChevronLeft } from "lucide-react";
import { SurveyAnalyticsResult } from "../lib/surveys-engine";

interface SurveyAnalyticsViewProps {
  surveyId: string;
  onBack: () => void;
}

export function SurveyAnalyticsView({ surveyId, onBack }: SurveyAnalyticsViewProps) {
  const [data, setData] = useState<{ survey: any; analytics: SurveyAnalyticsResult } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/surveys/${surveyId}/analytics`);
        if (res.ok) {
          const resData = await res.json();
          setData(resData.data);
        }
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalytics();
  }, [surveyId]);

  if (isLoading) {
    return <div className="text-center py-12 text-slate-400 text-sm">Loading sentiment analytics...</div>;
  }

  if (!data) {
    return <div className="text-center py-12 text-slate-400 text-sm">Analytics could not be loaded.</div>;
  }

  const { survey, analytics } = data;
  const enps = analytics.overallEnps;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back to Surveys</span>
      </button>

      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-100">{survey.title} Analytics</h2>
          {survey.isAnonymous && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              Anonymous
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Based on {analytics.totalSubmissions} responses submitted across teams.
        </p>
      </div>

      {/* eNPS Metric Card */}
      {enps && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Employee Net Promoter Score (eNPS)
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span
                  className={`text-4xl font-extrabold ${
                    enps.enpsScore > 30
                      ? "text-emerald-400"
                      : enps.enpsScore >= 0
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {enps.enpsScore > 0 ? `+${enps.enpsScore}` : enps.enpsScore}
                </span>
                <span className="text-xs text-slate-400">Scale: -100 to +100</span>
              </div>
            </div>

            {/* Distribution Badges */}
            <div className="flex items-center gap-3">
              <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg px-3 py-2 text-center">
                <span className="block text-xs font-bold text-emerald-400">{enps.promotersPct}%</span>
                <span className="block text-[10px] text-slate-400">Promoters ({enps.promotersCount})</span>
              </div>
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2 text-center">
                <span className="block text-xs font-bold text-amber-400">{enps.passivesPct}%</span>
                <span className="block text-[10px] text-slate-400">Passives ({enps.passivesCount})</span>
              </div>
              <div className="bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2 text-center">
                <span className="block text-xs font-bold text-red-400">{enps.detractorsPct}%</span>
                <span className="block text-[10px] text-slate-400">Detractors ({enps.detractorsCount})</span>
              </div>
            </div>
          </div>

          {/* Stacked bar */}
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${enps.promotersPct}%` }} />
            <div className="bg-amber-500 h-full transition-all" style={{ width: `${enps.passivesPct}%` }} />
            <div className="bg-red-500 h-full transition-all" style={{ width: `${enps.detractorsPct}%` }} />
          </div>
        </div>
      )}

      {/* Breakdown per question */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <span>Question Breakdowns</span>
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {analytics.questionsAnalytics.map((qa, idx) => (
            <div key={qa.questionId} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-100">
                  {idx + 1}. {qa.prompt}
                </h4>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {qa.responsesCount} responses
                </span>
              </div>

              {/* Likert 1-5 Average & Distribution */}
              {qa.type === "likert_5" && (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-blue-400">{qa.likertAverage}</span>
                    <span className="text-xs text-slate-500">/ 5.0 Average Satisfaction</span>
                  </div>
                  {qa.likertDistribution && (
                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div key={star} className="bg-slate-800/60 rounded p-2 border border-slate-700/40">
                          <span className="block font-bold text-slate-200">{star} ★</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {qa.likertDistribution![star] || 0} votes
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Text Answers (Anonymous) */}
              {qa.type === "text" && qa.textResponses && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {qa.textResponses.map((text, tIdx) => (
                    <p
                      key={tIdx}
                      className="text-xs text-slate-300 bg-slate-800/40 border border-slate-800/80 rounded-lg p-2.5 italic"
                    >
                      "{text}"
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
