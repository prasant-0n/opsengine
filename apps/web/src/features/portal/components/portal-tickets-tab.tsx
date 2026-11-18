"use client";

import React, { useState } from "react";
import { LifeBuoy, Plus, AlertCircle, Clock, MessageSquare } from "lucide-react";

interface TicketsTabProps {
  tickets: any[];
  onOpenTicket: (ticket: any) => void;
  onOpenNewTicketModal: () => void;
}

export function PortalTicketsTab({
  tickets,
  onOpenTicket,
  onOpenNewTicketModal,
}: TicketsTabProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = tickets.filter((t) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "open") return t.status === "open" || t.status === "triaged";
    if (filterStatus === "in_progress") return t.status === "in_progress" || t.status === "in_review";
    if (filterStatus === "resolved") return t.status === "resolved" || t.status === "closed";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          {["all", "open", "in_progress", "resolved"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                filterStatus === st
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
        <button
          onClick={onOpenNewTicketModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create Support Request
        </button>
      </div>

      {/* Tickets Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <LifeBuoy className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h4 className="font-semibold text-base">No support tickets found</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              You haven't logged any tickets matching this criteria. Need help with a bug or service inquiry?
            </p>
            <button
              onClick={onOpenNewTicketModal}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
            >
              Submit Ticket Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground border-b uppercase">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Deadline</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onOpenTicket(t)}
                    className="hover:bg-muted/30 cursor-pointer transition"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Created on {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-mono uppercase bg-muted text-muted-foreground">
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          t.priority === "urgent"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : t.priority === "high"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            : t.priority === "medium"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4">
                      {t.slaStatus ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          {t.slaStatus.isBreached ? (
                            <span className="flex items-center gap-1 text-red-600 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {t.slaStatus.label}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              {t.slaStatus.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTicket(t);
                        }}
                        className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground rounded text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        View Thread
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
