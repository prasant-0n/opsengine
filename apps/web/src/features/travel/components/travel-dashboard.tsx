"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plane,
  Plus,
  Users,
  Clock,
  DollarSign,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { TravelRequestCard, TravelRequestData } from "./travel-request-card";
import { CreateTravelModal } from "./create-travel-modal";
import { ItineraryTimeline } from "./itinerary-timeline";
import { TravelApprovalModal } from "./travel-approval-modal";
import { deriveTravelerDutyStatus } from "../lib/travel-engine";

interface TravelDashboardProps {
  currentUserId?: string;
}

export function TravelDashboard({ currentUserId }: TravelDashboardProps) {
  const [requests, setRequests] = useState<TravelRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"all" | "my" | "pending" | "live">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForItinerary, setSelectedForItinerary] = useState<TravelRequestData | null>(null);
  const [selectedForApproval, setSelectedForApproval] = useState<TravelRequestData | null>(null);

  async function fetchRequests() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/travel/requests");
      if (!res.ok) {
        throw new Error("Failed to load corporate travel requests");
      }
      const json = await res.json();
      setRequests(json.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  // Filtered list
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Tab filter
      if (activeTab === "my" && currentUserId && req.employeeId !== currentUserId) {
        return false;
      }
      if (activeTab === "pending" && !["submitted", "manager_approved"].includes(req.status)) {
        return false;
      }
      if (activeTab === "live") {
        const duty = deriveTravelerDutyStatus(req.startDate, req.endDate, req.status);
        if (duty !== "in_transit" && duty !== "on_site") {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = req.title.toLowerCase().includes(q);
        const matchesCity = req.destinationCity.toLowerCase().includes(q);
        const matchesCountry = req.destinationCountry.toLowerCase().includes(q);
        const matchesEmployee = req.employee?.displayName.toLowerCase().includes(q);
        return matchesTitle || matchesCity || matchesCountry || matchesEmployee;
      }

      return true;
    });
  }, [requests, activeTab, searchQuery, currentUserId]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalCount = requests.length;
    let liveTravelersCount = 0;
    let pendingApprovalsCount = 0;
    let totalApprovedSpendCents = 0n;

    for (const req of requests) {
      const duty = deriveTravelerDutyStatus(req.startDate, req.endDate, req.status);
      if (duty === "in_transit" || duty === "on_site") {
        liveTravelersCount++;
      }
      if (["submitted", "manager_approved"].includes(req.status)) {
        pendingApprovalsCount++;
      }
      if (["manager_approved", "finance_approved", "completed"].includes(req.status)) {
        totalApprovedSpendCents += BigInt(req.estimatedTotalCents || 0);
      }
    }

    const totalSpendDollars = (Number(totalApprovedSpendCents) / 100).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });

    return {
      totalCount,
      liveTravelersCount,
      pendingApprovalsCount,
      totalSpendDollars,
    };
  }, [requests]);

  async function handleBridgeExpenses(req: TravelRequestData) {
    try {
      setError(null);
      setSuccessMessage(null);
      const res = await fetch(`/api/travel/requests/${req.id}/expense-bridge`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to bridge expenses");
      }
      setSuccessMessage(
        `Successfully generated Expense Report claim (${data.data ? `$${(Number(data.data.totalAmountCents) / 100).toFixed(2)}` : "linked"}).`
      );
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to bridge expenses");
    }
  }

  async function handleRefreshSingle(reqId: string) {
    try {
      const res = await fetch(`/api/travel/requests/${reqId}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedForItinerary(json.data);
      }
      fetchRequests();
    } catch {
      fetchRequests();
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            Corporate Travel &amp; Duty of Care
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Itinerary tracking, automated per-diem validation, SoD approvals, and expense reconciliation.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn btn-primary text-xs"
        >
          <Plus className="w-4 h-4" /> New Travel Request
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Missions</span>
            <span className="p-1.5 rounded-lg bg-secondary text-primary">
              <Plane className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground mt-2 font-mono tabular-nums">{kpis.totalCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Tracked corporate journeys</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Live Duty of Care</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-500 mt-2 font-mono tabular-nums">
            {kpis.liveTravelersCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Travelers in transit / on-site</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending Approvals</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-500 mt-2 font-mono tabular-nums">
            {kpis.pendingApprovalsCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Awaiting manager / finance</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Authorized Spend</span>
            <span className="p-1.5 rounded-lg bg-secondary text-primary">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground mt-2 font-mono tabular-nums">
            ${kpis.totalSpendDollars}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Committed travel budget</p>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            All Missions
          </button>
          <button
            onClick={() => setActiveTab("my")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "my" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            My Travel
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "pending" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Pending Approvals ({kpis.pendingApprovalsCount})
          </button>
          <button
            onClick={() => setActiveTab("live")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "live" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Live Duty Roster ({kpis.liveTravelersCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destination, traveler..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Requests Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          Loading travel itineraries & duty records...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl">
          <Plane className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No travel requests found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === "pending"
              ? "All corporate travel requests are fully reviewed."
              : activeTab === "live"
              ? "No team members are currently in transit or on-site."
              : "Submit a new travel request to book flights, hotels, and request cash advances."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => (
            <TravelRequestCard
              key={req.id}
              request={req}
              currentUserId={currentUserId}
              onViewItinerary={(r) => {
                handleRefreshSingle(r.id);
              }}
              onApprove={(r) => setSelectedForApproval(r)}
              onBridgeExpenses={(r) => handleBridgeExpenses(r)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateTravelModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          fetchRequests();
          setSuccessMessage("Travel request successfully created and submitted for review.");
        }}
      />

      <ItineraryTimeline
        isOpen={!!selectedForItinerary}
        onClose={() => setSelectedForItinerary(null)}
        travelRequest={selectedForItinerary}
        onRefresh={() => {
          if (selectedForItinerary) {
            handleRefreshSingle(selectedForItinerary.id);
          }
        }}
      />

      <TravelApprovalModal
        isOpen={!!selectedForApproval}
        onClose={() => setSelectedForApproval(null)}
        travelRequest={selectedForApproval}
        onSuccess={() => {
          fetchRequests();
          setSuccessMessage("Decision successfully processed.");
        }}
      />
    </div>
  );
}
