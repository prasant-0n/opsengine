"use client";

import React from "react";
import { Sparkles, HeartHandshake, Award, Gift, Clock } from "lucide-react";
import { RecognitionBadgeItem } from "./give-recognition-modal";

export interface RecognitionItem {
  id: string;
  senderId: string;
  recipientId: string;
  badgeId: string;
  message: string;
  pointsAwarded: number;
  createdAt: string;
}

interface RecognitionFeedProps {
  recognitions: RecognitionItem[];
  badges: Map<string, RecognitionBadgeItem>;
  employeeNames: Map<string, string>;
  myTotalPoints: number;
  onOpenGiveModal: () => void;
}

export function RecognitionFeed({
  recognitions,
  badges,
  employeeNames,
  myTotalPoints,
  onOpenGiveModal,
}: RecognitionFeedProps) {
  return (
    <div className="space-y-6">
      {/* Top Points & Callout Banner */}
      <div className="bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-900 border border-pink-800/40 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Gift className="h-8 w-8" />
          </div>
          <div>
            <span className="text-xs font-medium text-pink-300">My Reward Points Balance</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-extrabold text-slate-100">{myTotalPoints}</span>
              <span className="text-xs text-slate-400 font-mono">pts</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Redeemable for company swag, tech stipends, or team celebrations.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenGiveModal}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          <span>Recognize a Peer</span>
        </button>
      </div>

      {/* Recognition Feed */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-pink-400" />
          <span>Company Recognition & Kudos Timeline</span>
        </h3>

        {recognitions.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
            <Sparkles className="mx-auto h-12 w-12 text-slate-600 mb-3" />
            <h4 className="text-base font-medium text-slate-300">No recognitions yet</h4>
            <p className="text-xs text-slate-500 mt-1">
              Be the first to celebrate a teammate’s outstanding work and award kudos points!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recognitions.map((rec) => {
              const badge = badges.get(rec.badgeId);
              const sender = employeeNames.get(rec.senderId) || "Teammate";
              const recipient = employeeNames.get(rec.recipientId) || "Colleague";

              return (
                <div
                  key={rec.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-200">{sender}</span>
                        <span className="text-xs text-slate-500">recognized</span>
                        <span className="text-xs font-semibold text-pink-300">{recipient}</span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-bold shrink-0">
                        +{rec.pointsAwarded} pts
                      </span>
                    </div>

                    {badge && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-950/40 border border-blue-900/40 rounded px-2.5 py-1 w-fit">
                        <Award className="h-3.5 w-3.5" />
                        <span className="font-semibold">{badge.name}</span>
                      </div>
                    )}

                    <p className="text-xs text-slate-300 bg-slate-800/40 border border-slate-800/80 rounded-lg p-3 italic">
                      "{rec.message}"
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-500 pt-3 border-t border-slate-800/60 mt-3">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
