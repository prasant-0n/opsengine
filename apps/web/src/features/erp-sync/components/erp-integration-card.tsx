"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Unlink, Settings } from "lucide-react";
import { ChartOfAccountsMapping } from "../lib/erp-engine";

interface ErpIntegrationCardProps {
  provider: "quickbooks" | "xero";
  title: string;
  description: string;
  integration?: {
    id: string;
    status: string;
    realmId?: string | null;
    coaMapping: unknown;
    lastSyncAt?: string | null;
    lastError?: string | null;
  } | null;
  onConnect: (provider: "quickbooks" | "xero") => void;
  onDisconnect: (id: string) => void;
  onConfigureCoa: (provider: "quickbooks" | "xero", currentMapping: ChartOfAccountsMapping) => void;
  isLoading?: boolean;
}

export function ErpIntegrationCard({
  provider,
  title,
  description,
  integration,
  onConnect,
  onDisconnect,
  onConfigureCoa,
  isLoading,
}: ErpIntegrationCardProps) {
  const isConnected = integration?.status === "connected";
  const coa = (integration?.coaMapping || {}) as ChartOfAccountsMapping;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                provider === "quickbooks"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}
            >
              {provider === "quickbooks" ? "QB" : "XR"}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{title}</h4>
              <p className="text-[11px] text-slate-400">General Ledger & Tax Sync</p>
            </div>
          </div>

          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isConnected
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-4">{description}</p>

        {isConnected && (
          <div className="space-y-1.5 p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 text-[11px] mb-4">
            <div className="flex justify-between text-slate-400">
              <span>Organization Realm:</span>
              <span className="text-slate-200 mono">{integration?.realmId || "Auto-detected"}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Revenue Account:</span>
              <span className="text-slate-200 mono">{coa.revenueAccountCode || "Default (200)"}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Last Synchronized:</span>
              <span className="text-slate-200">
                {integration?.lastSyncAt
                  ? new Date(integration.lastSyncAt).toLocaleString()
                  : "Pending first sync"}
              </span>
            </div>
          </div>
        )}

        {integration?.lastError && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] mb-4">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="truncate">{integration.lastError}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
        {isConnected ? (
          <>
            <button
              onClick={() => onConfigureCoa(provider, coa)}
              disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <Settings className="w-3.5 h-3.5 text-blue-400" />
              Chart of Accounts
            </button>
            <button
              onClick={() => integration && onDisconnect(integration.id)}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnect(provider)}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-500/20 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connect Connector
          </button>
        )}
      </div>
    </div>
  );
}
