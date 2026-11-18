"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";

export interface ErpSyncLogItem {
  id: string;
  provider: string;
  entityType: string;
  externalId?: string | null;
  status: string;
  idempotencyKey: string;
  errorMessage?: string | null;
  syncedAt?: string | null;
  createdAt: string;
}

interface ErpSyncLogsTableProps {
  logs: ErpSyncLogItem[];
  isLoading?: boolean;
  onRefresh: () => void;
}

export function ErpSyncLogsTable({ logs, isLoading, onRefresh }: ErpSyncLogsTableProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-sm">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-semibold text-white">ERP Synchronization Ledger</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of outbound and inbound journal entries pushed to external general ledgers.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs">
          No synchronization events recorded yet. Connect an ERP and issue an invoice to begin.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Provider</th>
                <th className="py-2.5 px-4">External ERP ID</th>
                <th className="py-2.5 px-4">Idempotency Key</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Synced At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-4 capitalize font-medium text-white">
                    {log.entityType}
                  </td>
                  <td className="py-2.5 px-4 uppercase font-mono text-[11px] text-blue-400">
                    {log.provider}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-300">
                    {log.externalId || "—"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[140px]">
                    {log.idempotencyKey.slice(0, 16)}...
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        log.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : log.status === "failed"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {log.status === "success" ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : log.status === "failed" ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                    {log.syncedAt ? new Date(log.syncedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
