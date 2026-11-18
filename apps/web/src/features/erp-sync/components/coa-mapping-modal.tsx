"use client";

import React, { useState } from "react";
import { X, Save, Settings } from "lucide-react";
import { ChartOfAccountsMapping, ErpProvider } from "../lib/erp-engine";

interface CoaMappingModalProps {
  provider: ErpProvider;
  currentMapping: ChartOfAccountsMapping;
  onSave: (provider: ErpProvider, updatedMapping: ChartOfAccountsMapping) => Promise<void>;
  onClose: () => void;
}

export function CoaMappingModal({
  provider,
  currentMapping,
  onSave,
  onClose,
}: CoaMappingModalProps) {
  const [revenueCode, setRevenueCode] = useState(currentMapping.revenueAccountCode || "200");
  const [receivablesCode, setReceivablesCode] = useState(
    currentMapping.receivablesAccountCode || "120"
  );
  const [taxCode, setTaxCode] = useState(currentMapping.salesTaxAccountCode || "800");
  const [depositCode, setDepositCode] = useState(
    currentMapping.bankDepositAccountCode || "090"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(provider, {
        revenueAccountCode: revenueCode,
        receivablesAccountCode: receivablesCode,
        salesTaxAccountCode: taxCode,
        bankDepositAccountCode: depositCode,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0B0F17] p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-white">
              Chart of Accounts Mapping ({provider === "quickbooks" ? "QuickBooks" : "Xero"})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Revenue / Income Account Code
            </label>
            <input
              type="text"
              value={revenueCode}
              onChange={(e) => setRevenueCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. 200 or 4000"
              required
            />
            <p className="text-[11px] text-slate-500 mt-0.5">
              General ledger code for professional services revenue.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Accounts Receivable Code
            </label>
            <input
              type="text"
              value={receivablesCode}
              onChange={(e) => setReceivablesCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. 120 or 1100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Sales Tax / GST Liability Code
            </label>
            <input
              type="text"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. 800 or 2200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Bank Deposit Account Code
            </label>
            <input
              type="text"
              value={depositCode}
              onChange={(e) => setDepositCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. 090 or 1000"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save Mapping
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
