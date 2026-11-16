"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { EXPENSE_CATEGORIES, validateExpenseItem } from "../lib/expenses-policy";

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    currency: string;
    items: Array<{
      category: string;
      description: string;
      amountCents: number;
      spentOn: string;
      receiptId?: string | null;
    }>;
  }) => Promise<void>;
}

export function ExpenseClaimModal({ isOpen, onClose, onSubmit }: ClaimModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState<
    Array<{
      category: string;
      description: string;
      amount: string;
      spentOn: string;
      receiptId?: string | null;
      fileName?: string | null;
    }>
  >([
    {
      category: "meals",
      description: "",
      amount: "",
      spentOn: new Date().toISOString().slice(0, 10),
      receiptId: null,
      fileName: null,
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        category: "travel",
        description: "",
        amount: "",
        spentOn: new Date().toISOString().slice(0, 10),
        receiptId: null,
        fileName: null,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleFakeUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await fetch("/api/expenses/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          fileSize: file.size,
        }),
      });
      const data = await res.json();
      if (data.data?.id) {
        handleItemChange(index, "receiptId", data.data.id);
        handleItemChange(index, "fileName", file.name);
      }
    } catch (err) {
      console.error("Receipt upload error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide an expense claim title");
      return;
    }

    if (items.length === 0) {
      setError("Please add at least one expense line item");
      return;
    }

    const formattedItems = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const parsedAmount = parseFloat(it.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError(`Item #${i + 1} has an invalid amount`);
        return;
      }
      formattedItems.push({
        category: it.category,
        description: it.description,
        amountCents: Math.round(parsedAmount * 100),
        spentOn: it.spentOn,
        receiptId: it.receiptId || null,
      });
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        currency,
        items: formattedItems,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit expense report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold">New Reimbursement Claim</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Itemize expenses incurred for business operations. Per-diem limits and receipts over $50 will be automatically audited.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex-1 flex flex-col overflow-hidden">
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Claim Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client Onsite Technical Workshop - Chicago"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Business Purpose
              </label>
              <textarea
                rows={2}
                placeholder="Brief summary of trip, project, or operational requirement..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Expense Line Items
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => {
                  const check = validateExpenseItem({
                    category: item.category,
                    amountCents: Math.round((parseFloat(item.amount) || 0) * 100),
                    receiptId: item.receiptId,
                  });

                  return (
                    <div key={idx} className="p-3 bg-muted/40 border rounded-xl space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                            className="w-full px-2 py-1.5 bg-background border rounded text-xs capitalize focus:outline-none"
                          >
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            required
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className="w-full px-2 py-1.5 bg-background border rounded text-xs focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Amount ($)"
                            value={item.amount}
                            onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                            className="w-full px-2 py-1.5 bg-background border rounded text-xs focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="cursor-pointer px-2 py-1.5 bg-background border rounded text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground truncate">
                            <Upload className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.fileName || "Receipt"}</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFakeUpload(idx, e)}
                            />
                          </label>
                        </div>
                        <div className="col-span-1 text-right">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-muted-foreground hover:text-red-500 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Policy Flag Warning */}
                      {check.policyViolation && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {check.violationReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submitting ? "Submitting..." : "Submit Reimbursement Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
