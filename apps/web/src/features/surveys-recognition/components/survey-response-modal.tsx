"use client";

import React, { useState } from "react";
import { X, ShieldCheck, HeartHandshake, CheckCircle2 } from "lucide-react";
import { SurveyQuestion } from "../lib/surveys-engine";

export interface SurveyData {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  isAnonymous: boolean;
  questions: SurveyQuestion[];
}

interface SurveyResponseModalProps {
  survey: SurveyData | null;
  onClose: () => void;
  onSubmit: (surveyId: string, answers: any[], npsScore?: number) => Promise<void>;
}

export function SurveyResponseModal({
  survey,
  onClose,
  onSubmit,
}: SurveyResponseModalProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!survey) return null;

  const handleScoreChange = (questionId: string, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], score },
    }));
  };

  const handleTextChange = (questionId: string, textAnswer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], textAnswer },
    }));
  };

  const handleChoiceChange = (questionId: string, selectedOption: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], selectedOption },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let npsScore: number | undefined;
      const formattedAnswers = survey.questions.map((q) => {
        const val = answers[q.id] || {};
        if (q.type === "nps_10" && typeof val.score === "number") {
          npsScore = val.score;
        }
        return {
          questionId: q.id,
          score: val.score,
          selectedOption: val.selectedOption,
          textAnswer: val.textAnswer,
        };
      });

      await onSubmit(survey.id, formattedAnswers, npsScore);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit survey");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{survey.title}</h3>
            {survey.description && (
              <p className="text-xs text-slate-400 mt-0.5">{survey.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {survey.isAnonymous && (
          <div className="bg-blue-950/40 border border-blue-800/60 rounded-lg p-3 text-xs text-blue-300 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
            <span>
              100% Cryptographic Anonymity: Your identity is completely decoupled and unlinked from your responses.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {survey.questions.map((q, idx) => {
            const currentVal = answers[q.id] || {};

            return (
              <div key={q.id} className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-slate-200">
                  {idx + 1}. {q.prompt}
                </label>

                {/* NPS 0-10 Scale */}
                {q.type === "nps_10" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>0 - Not at all likely</span>
                      <span>10 - Extremely likely</span>
                    </div>
                    <div className="grid grid-cols-11 gap-1">
                      {Array.from({ length: 11 }).map((_, n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleScoreChange(q.id, n)}
                          className={`py-2 text-xs font-semibold rounded transition-colors ${
                            currentVal.score === n
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Likert 1-5 Scale */}
                {q.type === "likert_5" && (
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { val: 1, label: "Strongly Disagree" },
                      { val: 2, label: "Disagree" },
                      { val: 3, label: "Neutral" },
                      { val: 4, label: "Agree" },
                      { val: 5, label: "Strongly Agree" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => handleScoreChange(q.id, opt.val)}
                        className={`py-2 px-1 text-xs text-center rounded border transition-colors ${
                          currentVal.score === opt.val
                            ? "bg-blue-600 text-white border-blue-500 font-semibold"
                            : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                        }`}
                      >
                        <div className="font-bold">{opt.val}</div>
                        <div className="text-[10px] mt-0.5 leading-tight">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Multiple Choice */}
                {q.type === "choice" && q.options && (
                  <div className="space-y-1.5">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          currentVal.selectedOption === opt
                            ? "bg-blue-950/40 border-blue-600 text-blue-200"
                            : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={currentVal.selectedOption === opt}
                          onChange={() => handleChoiceChange(q.id, opt)}
                          className="accent-blue-500"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Free Text */}
                {q.type === "text" && (
                  <textarea
                    rows={3}
                    placeholder="Provide your open feedback..."
                    value={currentVal.textAnswer || ""}
                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            );
          })}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
            >
              {isSubmitting ? "Submitting..." : "Submit Response"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
