"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ErpIntegrationCard } from "./erp-integration-card";
import { CoaMappingModal } from "./coa-mapping-modal";
import { ErpSyncLogsTable, ErpSyncLogItem } from "./erp-sync-logs-table";
import { ChartOfAccountsMapping, ErpProvider } from "../lib/erp-engine";
import { Landmark, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function ErpDashboard() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [logs, setLogs] = useState<ErpSyncLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalProvider, setModalProvider] = useState<ErpProvider | null>(null);
  const [currentMapping, setCurrentMapping] = useState<ChartOfAccountsMapping>({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [intRes, logRes] = await Promise.all([
        fetch("/api/erp/integrations"),
        fetch("/api/erp/sync/logs"),
      ]);

      if (intRes.ok) {
        const intData = await intRes.json();
        setIntegrations(intData.data || []);
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.data || []);
      }
    } catch (_err) {
      // Handled gracefully in UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async (provider: ErpProvider) => {
    setIsLoading(true);
    try {
      await fetch("/api/erp/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          realmId: provider === "quickbooks" ? "QBO-REALM-99120" : "XERO-TENANT-3312",
          coaMapping: {
            revenueAccountCode: provider === "quickbooks" ? "4000" : "200",
            receivablesAccountCode: provider === "quickbooks" ? "1100" : "120",
            salesTaxAccountCode: provider === "quickbooks" ? "2200" : "800",
            bankDepositAccountCode: provider === "quickbooks" ? "1000" : "090",
          },
        }),
      });
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    setIsLoading(true);
    try {
      await fetch(`/api/erp/integrations/${id}`, {
        method: "DELETE",
      });
      await loadData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCoaModal = (provider: ErpProvider, mapping: ChartOfAccountsMapping) => {
    setModalProvider(provider);
    setCurrentMapping(mapping);
  };

  const handleSaveCoaMapping = async (
    provider: ErpProvider,
    updatedMapping: ChartOfAccountsMapping
  ) => {
    await fetch("/api/erp/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        coaMapping: updatedMapping,
      }),
    });
    await loadData();
  };

  const qbIntegration = integrations.find((i) => i.provider === "quickbooks");
  const xeroIntegration = integrations.find((i) => i.provider === "xero");

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/dashboard/finance" className="hover:text-slate-200 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Finance Overview
            </Link>
            <span>/</span>
            <span className="text-slate-200">ERP & General Ledger</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Landmark className="w-6 h-6 text-blue-400" />
            Accounting ERP Integrations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Bi-directional synchronization for Intuit QuickBooks Online and Xero with automated journal posting.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ErpIntegrationCard
          provider="quickbooks"
          title="QuickBooks Online"
          description="Automate sales receipt generation, customer balance reconciliation, and sales tax accounting directly into Intuit QuickBooks."
          integration={qbIntegration}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onConfigureCoa={handleOpenCoaModal}
          isLoading={isLoading}
        />

        <ErpIntegrationCard
          provider="xero"
          title="Xero Accounting"
          description="Push authorized invoices, bank payments, and chart-of-accounts revenue tracking into Xero General Ledger with zero latency."
          integration={xeroIntegration}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onConfigureCoa={handleOpenCoaModal}
          isLoading={isLoading}
        />
      </div>

      <ErpSyncLogsTable logs={logs} isLoading={isLoading} onRefresh={loadData} />

      {modalProvider && (
        <CoaMappingModal
          provider={modalProvider}
          currentMapping={currentMapping}
          onSave={handleSaveCoaMapping}
          onClose={() => setModalProvider(null)}
        />
      )}
    </div>
  );
}
