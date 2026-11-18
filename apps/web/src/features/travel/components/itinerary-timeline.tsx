"use client";

import React, { useState } from "react";
import {
  X,
  Plane,
  Building,
  Train,
  Car,
  Plus,
  Ticket,
  Clock,
} from "lucide-react";
import { TravelRequestData } from "./travel-request-card";

export interface ItineraryItemData {
  id: string;
  travelRequestId: string;
  type: string;
  carrierOrVendor: string;
  bookingReference?: string | null;
  confirmationCode?: string | null;
  departureAt?: string | null;
  arrivalAt?: string | null;
  costCents: string | number;
  notes?: string | null;
  createdAt: string;
}

interface ItineraryTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  travelRequest: TravelRequestData | null;
  onRefresh: () => void;
}

export function ItineraryTimeline({
  isOpen,
  onClose,
  travelRequest,
  onRefresh,
}: ItineraryTimelineProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [type, setType] = useState("flight");
  const [carrierOrVendor, setCarrierOrVendor] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [arrivalAt, setArrivalAt] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !travelRequest) return null;

  const items: ItineraryItemData[] = travelRequest.itineraryItems || [];

  const totalBookedCents = items.reduce(
    (acc, it) => acc + BigInt(it.costCents || 0),
    0n
  );
  const totalBookedDollars = (Number(totalBookedCents) / 100).toFixed(2);
  const estimatedDollars = (Number(travelRequest.estimatedTotalCents || 0) / 100).toFixed(2);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!travelRequest) return;
    setError(null);

    if (!carrierOrVendor.trim()) {
      setError("Carrier or vendor name is required.");
      return;
    }

    try {
      setLoading(true);
      const cents = Math.round((parseFloat(costDollars) || 0) * 100);

      const res = await fetch(`/api/travel/requests/${travelRequest.id}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          carrierOrVendor: carrierOrVendor.trim(),
          bookingReference: bookingReference.trim() || null,
          confirmationCode: confirmationCode.trim() || null,
          departureAt: departureAt || null,
          arrivalAt: arrivalAt || null,
          costCents: cents,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add itinerary item");
      }

      setShowAddForm(false);
      setCarrierOrVendor("");
      setBookingReference("");
      setConfirmationCode("");
      setDepartureAt("");
      setArrivalAt("");
      setCostDollars("");
      setNotes("");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to add itinerary item");
    } finally {
      setLoading(false);
    }
  }

  function renderIcon(itemType: string) {
    switch (itemType.toLowerCase()) {
      case "flight":
        return <Plane className="w-4 h-4 text-sky-400" />;
      case "hotel":
        return <Building className="w-4 h-4 text-emerald-400" />;
      case "train":
        return <Train className="w-4 h-4 text-amber-400" />;
      case "rental_car":
        return <Car className="w-4 h-4 text-purple-400" />;
      default:
        return <Ticket className="w-4 h-4 text-blue-400" />;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Plane className="w-5 h-5 text-blue-400" />
              Itinerary & Bookings: {travelRequest.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {travelRequest.destinationCity}, {travelRequest.destinationCountry} · Est. Budget: ${estimatedDollars} {travelRequest.currency}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Total Booked</span>
            <div className="text-sm font-bold text-emerald-400">
              ${totalBookedDollars} {travelRequest.currency}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Button: Add Segment */}
        {!showAddForm && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Booking Segment
            </button>
          </div>
        )}

        {/* Add Segment Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="mb-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Add Booking Segment
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Segment Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="flight">Flight</option>
                  <option value="hotel">Hotel / Lodging</option>
                  <option value="train">Train</option>
                  <option value="rental_car">Rental Car</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Carrier / Vendor *</label>
                <input
                  type="text"
                  required
                  value={carrierOrVendor}
                  onChange={(e) => setCarrierOrVendor(e.target.value)}
                  placeholder="e.g. British Airways / Hilton"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Booking Ref</label>
                <input
                  type="text"
                  value={bookingReference}
                  onChange={(e) => setBookingReference(e.target.value)}
                  placeholder="e.g. BA-94812"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Confirmation Code</label>
                <input
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  placeholder="e.g. PNR: 7KJ9L"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Cost ({travelRequest.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costDollars}
                  onChange={(e) => setCostDollars(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Departure / Check-in</label>
                <input
                  type="datetime-local"
                  value={departureAt}
                  onChange={(e) => setDepartureAt(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Arrival / Check-out</label>
                <input
                  type="datetime-local"
                  value={arrivalAt}
                  onChange={(e) => setArrivalAt(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes / Instructions</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Terminal 5, breakfast included"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
              >
                {loading ? "Adding..." : "Save Segment"}
              </button>
            </div>
          </form>
        )}

        {/* Timeline List */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800">
              <Ticket className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No confirmed travel segments yet.</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Add flights, hotels, and train bookings to build the mission itinerary.
              </p>
            </div>
          ) : (
            items.map((item, idx) => {
              const itemDollars = (Number(item.costCents || 0) / 100).toFixed(2);
              return (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 shrink-0 mt-0.5">
                      {renderIcon(item.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white capitalize">
                          {item.type}
                        </span>
                        <span className="text-xs text-slate-300 font-medium">
                          — {item.carrierOrVendor}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {item.departureAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Dep: {new Date(item.departureAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {item.arrivalAt && (
                          <span className="flex items-center gap-1">
                            Arr: {new Date(item.arrivalAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      {(item.bookingReference || item.confirmationCode) && (
                        <div className="text-[11px] text-slate-500 mt-1 flex gap-2">
                          {item.bookingReference && <span>Ref: {item.bookingReference}</span>}
                          {item.confirmationCode && <span>Code: {item.confirmationCode}</span>}
                        </div>
                      )}

                      {item.notes && (
                        <p className="text-[11px] text-slate-400 mt-1 italic">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-white">
                      ${itemDollars}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {travelRequest.currency}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
