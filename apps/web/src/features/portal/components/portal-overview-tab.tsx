"use client";

import React from "react";
import { LifeBuoy, CheckCircle2, Clock, FileText, AlertTriangle } from "lucide-react";

interface OverviewProps {
  tickets: any[];
  deliverables: any[];
  invoices: any[];
  onSelectTab: (tab: "overview" | "tickets" | "deliverables" | "invoices") => void;
  onOpenNewTicket: () => void;
}

export function PortalOverviewTab({
  tickets,
  deliverables,
  invoices,
  onSelectTab,
  onOpenNewTicket,
}: OverviewProps) {
  const openTickets = tickets.filter((t) => t.status !== "closed" && t.status !== "resolved");
  const pendingDeliverables = deliverables.filter((d) => d.status === "pending_review");
  const breachedTickets = tickets.filter((t) => t.slaStatus?.isBreached);
  const unpaidInvoices = invoices.filter((i) => i.isPayable);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Welcome to your Customer Portal</h2>
          <p className="text-blue-100 text-sm mt-1">
            Track support cases, review project deliverables, and manage billing in real-time.
          </p>
        </div>
        <button
          onClick={onOpenNewTicket}
          className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-lg shadow transition flex items-center gap-2 text-sm"
        >
          <LifeBuoy className="w-4 h-4" />
          Submit Support Ticket
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onSelectTab("tickets")}
          className="p-5 bg-card border rounded-xl hover:shadow-md cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Tickets</p>
            <p className="text-2xl font-bold mt-1">{openTickets.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tickets.length} total submitted
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => onSelectTab("deliverables")}
          className="p-5 bg-card border rounded-xl hover:shadow-md cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Approvals</p>
            <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-500">
              {pendingDeliverables.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {deliverables.length - pendingDeliverables.length} signed off
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => onSelectTab("tickets")}
          className="p-5 bg-card border rounded-xl hover:shadow-md cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SLA Adherence</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-500">
              {tickets.length > 0
                ? `${Math.round(((tickets.length - breachedTickets.length) / tickets.length) * 100)}%`
                : "100%"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {breachedTickets.length === 0 ? "All within SLA" : `${breachedTickets.length} breached`}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => onSelectTab("invoices")}
          className="p-5 bg-card border rounded-xl hover:shadow-md cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Invoices</p>
            <p className="text-2xl font-bold mt-1">{unpaidInvoices.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {unpaidInvoices.length === 0 ? "All settled" : "Awaiting payment"}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Actionable Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-blue-600" />
              Recent Support Tickets
            </h3>
            <button
              onClick={() => onSelectTab("tickets")}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View all
            </button>
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No tickets logged yet.</p>
          ) : (
            <div className="divide-y divide-border text-sm">
              {tickets.slice(0, 4).map((t) => (
                <div key={t.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="uppercase">{t.type}</span>
                      <span>•</span>
                      <span>Priority: {t.priority}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      t.status === "open"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : t.status === "in_progress"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deliverables for Review */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Milestone Deliverables Pending Acceptance
            </h3>
            <button
              onClick={() => onSelectTab("deliverables")}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View all
            </button>
          </div>
          {pendingDeliverables.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All deliverables have been approved!</p>
            </div>
          ) : (
            <div className="divide-y divide-border text-sm">
              {pendingDeliverables.slice(0, 4).map((d) => (
                <div key={d.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted on {new Date(d.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onSelectTab("deliverables")}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-medium transition"
                  >
                    Review & Sign Off
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
