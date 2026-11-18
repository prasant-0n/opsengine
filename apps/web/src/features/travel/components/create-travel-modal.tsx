"use client";

import React, { useState, useMemo } from "react";
import { X, Plane, AlertTriangle, CheckCircle, MapPin, DollarSign } from "lucide-react";
import {
  calculateTripDurationDays,
  evaluatePerDiemCompliance,
  getDestinationTier,
} from "../lib/travel-engine";

interface CreateTravelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTravelModal({ isOpen, onClose, onSuccess }: CreateTravelModalProps) {
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("client_engagement");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estimatedTotalDollars, setEstimatedTotalDollars] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time compliance derivation
  const policyPreview = useMemo(() => {
    if (!startDate || !endDate) return null;
    try {
      const days = calculateTripDurationDays(startDate, endDate);
      const estCents = Math.round((parseFloat(estimatedTotalDollars) || 0) * 100);
      const tier = getDestinationTier(destinationCity, destinationCountry);
      const comp = evaluatePerDiemCompliance(estCents, days, tier);
      return { days, tier, comp };
    } catch {
      return null;
    }
  }, [startDate, endDate, estimatedTotalDollars, destinationCity, destinationCountry]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !destinationCity.trim() || !destinationCountry.trim() || !startDate || !endDate) {
      setError("Please fill in all mandatory fields.");
      return;
    }

    try {
      setSubmitting(true);
      const estCents = Math.round((parseFloat(estimatedTotalDollars) || 0) * 100);

      const res = await fetch("/api/travel/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          purpose,
          destinationCity: destinationCity.trim(),
          destinationCountry: destinationCountry.trim(),
          startDate,
          endDate,
          estimatedTotalCents: estCents,
          currency,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit travel request");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <Plane className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">New Corporate Travel Request</h2>
            <p className="text-xs text-slate-400">Submit multi-destination travel & per diem approval</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Trip Mission / Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Client Strategy Summit"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Trip Purpose *</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 capitalize"
              >
                <option value="client_engagement">Client Engagement</option>
                <option value="sales_pitch">Sales Pitch</option>
                <option value="conference">Tech Conference</option>
                <option value="internal_meeting">Executive Meeting</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Currency *</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Destination City *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  placeholder="e.g. London"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Destination Country *</label>
              <input
                type="text"
                required
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                placeholder="e.g. United Kingdom"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Departure Date *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Return Date *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Estimated Total Cost ({currency})
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={estimatedTotalDollars}
                onChange={(e) => setEstimatedTotalDollars(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <DollarSign className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Real-time Per Diem Policy Check */}
          {policyPreview && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                policyPreview.comp.compliant
                  ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                  : "bg-amber-950/20 border-amber-800/40 text-amber-300"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  {policyPreview.comp.compliant ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  {policyPreview.comp.compliant
                    ? "Compliant with Corporate Per Diem Policy"
                    : "Exceeds Standard Per Diem Limit"}
                </span>
                <span>{policyPreview.days} Days Total</span>
              </div>
              <p className="text-[11px] opacity-80">
                Destination: {policyPreview.tier === "tier_1" ? "Tier 1 Metro" : policyPreview.tier === "tier_2" ? "Tier 2 Metro" : "Tier 3 City"} · Policy Cap: ${(policyPreview.comp.dailyLimitCents / 100).toFixed(0)}/day (Max: ${(policyPreview.comp.maxAllowedTotalCents / 100).toFixed(0)})
              </p>
              {!policyPreview.comp.compliant && (
                <p className="text-[11px] text-amber-200">
                  Note: A ${(policyPreview.comp.varianceCents / 100).toFixed(2)} variance requires secondary VP / Finance sign-off.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {submitting ? "Submitting..." : "Submit Travel Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
