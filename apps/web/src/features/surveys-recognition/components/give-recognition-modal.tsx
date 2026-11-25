"use client";

import React, { useState } from "react";
import { X, HeartHandshake, Sparkles } from "lucide-react";

export interface RecognitionBadgeItem {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  pointsValue: number;
  category: string;
}

export interface TeammateOption {
  id: string;
  fullName: string;
  title: string;
}

interface GiveRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges: RecognitionBadgeItem[];
  teammates: TeammateOption[];
  onSubmit: (data: { recipientId: string; badgeId: string; message: string; pointsAwarded?: number }) => Promise<void>;
}

export function GiveRecognitionModal({
  isOpen,
  onClose,
  badges,
  teammates,
  onSubmit,
}: GiveRecognitionModalProps) {
  const [recipientId, setRecipientId] = useState("");
  const [badgeId, setBadgeId] = useState(badges[0]?.id || "");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedBadge = badges.find((b) => b.id === badgeId) || badges[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!recipientId || !badgeId || !message) {
      setError("Please select a teammate, a badge, and write an appreciation note.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        recipientId,
        badgeId,
        message,
        pointsAwarded: selectedBadge?.pointsValue || 50,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit recognition");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Send Peer Recognition</h3>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Teammate *
            </label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a teammate to recognize --</option>
              {teammates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({t.title})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Select Cultural Value Badge *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {badges.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBadgeId(b.id)}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                    badgeId === b.id
                      ? "bg-blue-950/50 border-blue-500 text-blue-200"
                      : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold">{b.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                      +{b.pointsValue} pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{b.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Appreciation Message *
            </label>
            <textarea
              rows={3}
              placeholder="What did they do that was extraordinary? Share specific praise..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary text-xs"
            >
              <span>{isSubmitting ? "Submitting..." : "Send Recognition"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
