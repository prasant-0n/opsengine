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
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-secondary text-primary">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">Reward Points Balance</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-foreground font-mono tabular-nums">{myTotalPoints}</span>
              <span className="text-xs text-muted-foreground font-mono">pts</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Redeemable for company stipends, equipment, or team celebrations.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenGiveModal}
          className="btn btn-primary text-xs"
        >
          <Gift className="h-4 w-4" />
          <span>Recognize a Peer</span>
        </button>
      </div>

      {/* Recognition Feed */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-primary" />
          <span>Company Recognition Timeline</span>
        </h3>

        {recognitions.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <Gift className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <h4 className="text-sm font-medium text-foreground">No recognitions yet</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Celebrate a teammate's contribution and award kudos points.
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
                  className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{sender}</span>
                        <span className="text-xs text-muted-foreground">recognized</span>
                        <span className="text-xs font-semibold text-primary">{recipient}</span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-primary font-bold shrink-0">
                        +{rec.pointsAwarded} pts
                      </span>
                    </div>

                    {badge && (
                      <div className="flex items-center gap-1.5 text-xs text-foreground bg-secondary rounded px-2.5 py-1 w-fit">
                        <Award className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{badge.name}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
                      &quot;{rec.message}&quot;
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground pt-3 border-t border-border mt-3 font-mono tabular-nums">
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
