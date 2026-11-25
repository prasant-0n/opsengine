"use client";

import React from "react";
import {
  Plane,
  Building,
  Calendar,
  DollarSign,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  ShieldAlert,
} from "lucide-react";
import {
  calculateTripDurationDays,
  deriveTravelerDutyStatus,
  evaluatePerDiemCompliance,
  getDestinationTier,
  TravelerDutyStatus,
} from "../lib/travel-engine";

export interface TravelRequestData {
  id: string;
  tenantId: string;
  employeeId: string;
  title: string;
  purpose: string;
  destinationCity: string;
  destinationCountry: string;
  startDate: string;
  endDate: string;
  estimatedTotalCents: string | number;
  currency: string;
  advanceAmountCents: string | number;
  status: string;
  projectId?: string | null;
  clientAccountId?: string | null;
  linkedExpenseReportId?: string | null;
  managerApproverId?: string | null;
  managerApprovedAt?: string | null;
  financeApproverId?: string | null;
  financeApprovedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    displayName: string;
    jobTitle?: string | null;
  } | null;
  itineraryItems?: any[];
}

interface TravelRequestCardProps {
  request: TravelRequestData;
  currentUserId?: string;
  onViewItinerary: (req: TravelRequestData) => void;
  onApprove: (req: TravelRequestData) => void;
  onBridgeExpenses: (req: TravelRequestData) => void;
}

export function TravelRequestCard({
  request,
  currentUserId,
  onViewItinerary,
  onApprove,
  onBridgeExpenses,
}: TravelRequestCardProps) {
  let days: number;
  try {
    days = calculateTripDurationDays(request.startDate, request.endDate);
  } catch {
    days = 1;
  }

  const dutyStatus: TravelerDutyStatus = deriveTravelerDutyStatus(
    request.startDate,
    request.endDate,
    request.status
  );

  const tier = getDestinationTier(request.destinationCity, request.destinationCountry);
  const compliance = evaluatePerDiemCompliance(request.estimatedTotalCents, days, tier);

  const estDollars = (Number(request.estimatedTotalCents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const advanceDollars = (Number(request.advanceAmountCents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const isOwner = currentUserId && request.employeeId === currentUserId;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg">
      <div className="space-y-3">
        {/* Header: Title, Duty Status, & Status */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Plane className="w-4 h-4" />
              </span>
              <h3 className="text-base font-semibold text-white leading-tight">{request.title}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {request.destinationCity}, {request.destinationCountry}
              {request.employee && (
                <span className="text-slate-500">· {request.employee.displayName}</span>
              )}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {/* Approval Status Badge */}
            {request.status === "submitted" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-3 h-3" /> Submitted
              </span>
            )}
            {request.status === "manager_approved" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <CheckCircle2 className="w-3 h-3" /> Manager Approved
              </span>
            )}
            {request.status === "finance_approved" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Finance Approved
              </span>
            )}
            {request.status === "completed" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <CheckCircle2 className="w-3 h-3" /> Claim Linked
              </span>
            )}
            {request.status === "rejected" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-3 h-3" /> Rejected
              </span>
            )}

            {/* Live Duty Status Badge */}
            {dutyStatus === "in_transit" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                In Transit
              </span>
            )}
            {dutyStatus === "on_site" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-300">
                On-Site (Active Mission)
              </span>
            )}
            {dutyStatus === "planned" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                Upcoming ({days}d)
              </span>
            )}
            {dutyStatus === "returned" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-500">
                Returned
              </span>
            )}
          </div>
        </div>

        {/* Dates & Purpose */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {new Date(request.startDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {new Date(request.endDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              ({days} {days === 1 ? "day" : "days"})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 justify-end capitalize">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <span>{request.purpose.replace("_", " ")}</span>
          </div>
        </div>

        {/* Financials & Policy Compliance */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              Estimated Budget:
            </span>
            <span className="font-semibold text-white">
              ${estDollars} {request.currency}
            </span>
          </div>

          {Number(request.advanceAmountCents) > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-400 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                Cash Advance Disbursed:
              </span>
              <span className="font-semibold text-emerald-300">
                ${advanceDollars} {request.currency}
              </span>
            </div>
          )}

          {/* Compliance notice */}
          <div
            className={`text-[11px] px-2 py-1 rounded flex items-center justify-between ${
              compliance.compliant
                ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/40"
                : "bg-amber-950/30 text-amber-400 border border-amber-800/40"
            }`}
          >
            <span>
              {tier === "tier_1" ? "Tier 1 Metro" : tier === "tier_2" ? "Tier 2 Metro" : "Tier 3 City"} · $
              {(compliance.dailyRateCents / 100).toFixed(0)}/day
            </span>
            <span>
              {compliance.compliant
                ? "✓ Within Per Diem Cap"
                : `+${(compliance.varianceCents / 100).toFixed(0)} Variance`}
            </span>
          </div>

          {request.rejectionReason && (
            <div className="text-xs bg-rose-950/40 border border-rose-800/40 text-rose-300 p-2 rounded flex items-start gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-medium">Rejection Reason:</span> {request.rejectionReason}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800">
        <button
          onClick={() => onViewItinerary(request)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" /> Itinerary
        </button>

        <div className="flex items-center gap-2">
          {/* Approval Button (only if status is submitted or manager_approved and not self-approval) */}
          {["submitted", "manager_approved"].includes(request.status) && !isOwner && (
            <button
              onClick={() => onApprove(request)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Review / Approve
            </button>
          )}

          {/* Expense Bridge Button */}
          {["manager_approved", "finance_approved"].includes(request.status) && (
            <button
              onClick={() => onBridgeExpenses(request)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1"
            >
              <CreditCard className="w-3.5 h-3.5" /> Claim Expenses
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
