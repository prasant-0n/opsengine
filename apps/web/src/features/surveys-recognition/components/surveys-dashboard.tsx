"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { SurveysList } from "./surveys-list";
import { SurveyResponseModal, SurveyData } from "./survey-response-modal";
import { RecognitionFeed, RecognitionItem } from "./recognition-feed";
import { GiveRecognitionModal, RecognitionBadgeItem, TeammateOption } from "./give-recognition-modal";
import { SurveyAnalyticsView } from "./survey-analytics-view";
import {
  HeartHandshake,
  MessageSquare,
  Sparkles,
  Gift,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export function SurveysDashboard() {
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [recognitions, setRecognitions] = useState<RecognitionItem[]>([]);
  const [badges, setBadges] = useState<RecognitionBadgeItem[]>([]);
  const [teammates, setTeammates] = useState<TeammateOption[]>([]);
  const [myTotalPoints, setMyTotalPoints] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"surveys" | "recognition">("surveys");
  const [selectedSurveyForModal, setSelectedSurveyForModal] = useState<SurveyData | null>(null);
  const [selectedSurveyForAnalytics, setSelectedSurveyForAnalytics] = useState<string | null>(null);
  const [isGiveModalOpen, setIsGiveModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [surveysRes, recRes, badgesRes, empRes] = await Promise.all([
        fetch("/api/surveys"),
        fetch("/api/recognitions"),
        fetch("/api/recognitions/badges"),
        fetch("/api/employees"),
      ]);

      if (surveysRes.ok) {
        const sData = await surveysRes.json();
        setSurveys(sData.data || []);
      }
      if (recRes.ok) {
        const rData = await recRes.json();
        setRecognitions(rData.data || []);
        setMyTotalPoints(rData.myTotalPoints || 0);
      }
      if (badgesRes.ok) {
        const bData = await badgesRes.json();
        setBadges(bData.data || []);
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        const emps = (empData.data || []).map((e: any) => ({
          id: e.id,
          fullName: e.fullName || `${e.firstName} ${e.lastName}`,
          title: e.jobTitle || e.title || "Team Member",
        }));
        setTeammates(emps);
      }
    } catch (err) {
      console.error("Failed to load surveys and recognition data", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const badgeMap = useMemo(() => {
    const map = new Map<string, RecognitionBadgeItem>();
    for (const b of badges) {
      map.set(b.id, b);
    }
    return map;
  }, [badges]);

  const employeeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teammates) {
      map.set(t.id, t.fullName);
    }
    return map;
  }, [teammates]);

  const handleSubmitSurveyResponse = async (surveyId: string, answers: any[], npsScore?: number) => {
    const res = await fetch(`/api/surveys/${surveyId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, npsScore }),
    });

    if (res.ok) {
      setStatusMessage("Survey feedback submitted! Thank you for sharing your thoughts.");
      await loadData();
    } else {
      const err = await res.json();
      throw new Error(err.error || "Failed to submit survey");
    }
  };

  const handleGiveRecognition = async (data: any) => {
    const res = await fetch("/api/recognitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setStatusMessage("Kudos awarded! Your recognition has been posted to the company feed.");
      await loadData();
      setActiveTab("recognition");
    } else {
      const err = await res.json();
      throw new Error(err.error || "Failed to send recognition");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-foreground">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-primary" />
              <span>Surveys &amp; Peer Recognition</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Anonymous sentiment surveys, pulse cycles, and team recognition.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGiveModalOpen(true)}
              className="btn btn-primary text-xs"
            >
              <Gift className="h-4 w-4" />
              <span>Give Recognition</span>
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Active Surveys</span>
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">{surveys.length}</p>
          <span className="text-[11px] text-muted-foreground">Pulse &amp; eNPS cycles</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Total Recognitions</span>
            <Gift className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">{recognitions.length}</p>
          <span className="text-[11px] text-muted-foreground">Recognitions shared</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Reward Points</span>
            <Gift className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">{myTotalPoints}</p>
          <span className="text-[11px] text-muted-foreground">Earned points balance</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium">Badges</span>
            <HeartHandshake className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">{badges.length}</p>
          <span className="text-[11px] text-muted-foreground">Values &amp; excellence pillars</span>
        </div>
      </div>

      {/* View Analytics Mode or Main Tabs */}
      {selectedSurveyForAnalytics ? (
        <SurveyAnalyticsView
          surveyId={selectedSurveyForAnalytics}
          onBack={() => setSelectedSurveyForAnalytics(null)}
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-slate-800 flex gap-6">
            <button
              onClick={() => setActiveTab("surveys")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "surveys"
                  ? "border-blue-500 text-blue-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Surveys & Pulse Feedback</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {surveys.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("recognition")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "recognition"
                  ? "border-pink-500 text-pink-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Recognition & Kudos Feed</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {recognitions.length}
              </span>
            </button>
          </div>

          <div>
            {activeTab === "surveys" && (
              <SurveysList
                surveys={surveys}
                onOpenSurvey={(s) => setSelectedSurveyForModal(s)}
                onOpenAnalytics={(id) => setSelectedSurveyForAnalytics(id)}
              />
            )}

            {activeTab === "recognition" && (
              <RecognitionFeed
                recognitions={recognitions}
                badges={badgeMap}
                employeeNames={employeeNameMap}
                myTotalPoints={myTotalPoints}
                onOpenGiveModal={() => setIsGiveModalOpen(true)}
              />
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <SurveyResponseModal
        survey={selectedSurveyForModal}
        onClose={() => setSelectedSurveyForModal(null)}
        onSubmit={handleSubmitSurveyResponse}
      />

      <GiveRecognitionModal
        isOpen={isGiveModalOpen}
        onClose={() => setIsGiveModalOpen(false)}
        badges={badges}
        teammates={teammates}
        onSubmit={handleGiveRecognition}
      />
    </div>
  );
}
