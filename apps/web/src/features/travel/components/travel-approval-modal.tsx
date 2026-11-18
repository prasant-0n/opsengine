"use client";

import React, { useState } from "react";
import { X, ShieldCheck, CheckCircle2, CreditCard } from "lucide-react";
import { TravelRequestData } from "./travel-request-card";

interface TravelApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  travelRequest: TravelRequestData | null;
  onSuccess: () => void;
}

export function TravelApprovalModal({
  isOpen,
  onClose,
  travelRequest,
  onSuccess,
}: TravelApprovalModalProps) {
  const [action, setAction] = useState<"manager_approve" | "finance_approve" | "reject">("manager_approve");
  const [advanceAmountDollars, setAdvanceAmountDollars] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !travelRequest) return null;

  const estDollars = (Number(travelRequest.estimatedTotalCents || 0) / 100).toFixed(2);

  async function handleDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!travelRequest) return;
    setError(null);

    if (action === "reject" && !rejectionReason.trim()) {
      setError("Please provide a reason for rejecting the travel request.");
      return;
    }

    try {
      setLoading(true);
      const advanceCents = advanceAmountDollars
        ? Math.round(parseFloat(advanceAmountDollars) * 100)
        : undefined;

      const endpoint =
        action === "manager_approve"
          ? `/api/travel/requests/${travelRequest.id}/approve-manager`
          : action === "finance_approve"
          ? `/api/travel/requests/${travelRequest.id}/approve-finance`
          : `/api/travel/requests/${travelRequest.id}/reject`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceAmountCents: advanceCents,
          rejectionReason: rejectionReason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process decision");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process decision");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Review Corporate Travel</h2>
            <p className="text-xs text-slate-400">{travelRequest.title}</p>
          </div>
        </div>

        {/* Trip summary badge */}
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl mb-4 text-xs space-y-1">
          <div className="flex justify-between text-slate-300">
            <span>Destination:</span>
            <span className="font-semibold text-white">
              {travelRequest.destinationCity}, {travelRequest.destinationCountry}
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Estimated Budget:</span>
            <span className="font-semibold text-emerald-400">
              ${estDollars} {travelRequest.currency}
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Current Status:</span>
            <span className="font-medium text-slate-200 capitalize">
              {travelRequest.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Toggle */}
        <form onSubmit={handleDecision} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Review Decision *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAction("manager_approve")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                  action === "manager_approve"
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                }`}
              >
                Manager Sign
              </button>
              <button
                type="button"
                onClick={() => setAction("finance_approve")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                  action === "finance_approve"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                }`}
              >
                Finance Sign
              </button>
              <button
                type="button"
                onClick={() => setAction("reject")}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                  action === "reject"
                    ? "bg-rose-600 text-white border-rose-500 shadow-sm"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                }`}
              >
                Reject
              </button>
            </div>
          </div>

          {/* If Finance Sign, show optional Cash Advance Disbursed input */}
          {action === "finance_approve" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Disburse Cash Advance ({travelRequest.currency}) [Optional]
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={advanceAmountDollars}
                  onChange={(e) => setAdvanceAmountDollars(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <CreditCard className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Cash advance will be debited and accounted for during the post-trip expense claim reconciliation.
              </p>
            </div>
          )}

          {/* If Reject, show mandatory reason */}
          {action === "reject" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Rejection Justification *
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the travel request is rejected or request budget modification..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors flex items-center gap-1.5 ${
                action === "reject"
                  ? "bg-rose-600 hover:bg-rose-500"
                  : action === "finance_approve"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {loading
                ? "Processing..."
                : action === "reject"
                ? "Confirm Rejection"
                : action === "finance_approve"
                ? "Authorize Finance & Advance"
                : "Approve as Manager"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
