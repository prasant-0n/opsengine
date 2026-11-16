"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { formatMoney, INVOICE_STATUSES } from "../lib/finance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

function statusBadge(status: string): string {
  switch (status) {
    case "paid":
      return "badge badge-tertiary";
    case "partially_paid":
      return "badge badge-primary";
    case "issued":
      return "badge badge-outline";
    case "overdue":
      return "badge badge-error";
    case "void":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function FinanceInvoicesPage() {
  const { can } = useShell();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ accountId: "", currency: "USD", paymentTermsDays: 30, notes: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = can("finance.invoice.create");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const res = await fetch(`/api/finance/invoices?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canCreate) return;
    fetch("/api/crm/accounts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => {});
  }, [canCreate]);

  async function create() {
    if (!form.accountId) {
      setError("Select a client account");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setShowForm(false);
      setForm({ accountId: "", currency: "USD", paymentTermsDays: 30, notes: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Invoices</h1>
          <p className="muted mono">finance.invoice.read</p>
        </div>
        {canCreate && (
          <div className="action-row">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1 inline" />
              New invoice
            </button>
          </div>
        )}
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Draft Invoice</DialogTitle>
            <DialogDescription>
              Create a new client invoice draft. Line items and payment milestones can be added afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid py-2">
            <label className="form-field">
              <span className="form-label">Client account*</span>
              <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">— select —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Currency</span>
              <input className="input" value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </label>
            <label className="form-field">
              <span className="form-label">Payment terms (days)</span>
              <input
                className="input"
                type="number"
                min={0}
                value={form.paymentTermsDays}
                onChange={(e) => setForm({ ...form, paymentTermsDays: Number(e.target.value) })}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Notes</span>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create draft"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="panel">
        <div className="inline-form">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Search number" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="state-panel state-panel-empty">No invoices.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Status</th>
                <th>Total</th>
                <th>Outstanding</th>
                <th>Issued</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/dashboard/finance/invoices/${inv.id}`} className="mono">
                      {inv.number}
                    </Link>
                  </td>
                  <td>
                    <span className={statusBadge(inv.status)}>{inv.status}</span>
                  </td>
                  <td className="mono">{formatMoney(inv.totalCents, inv.currency)}</td>
                  <td className="mono">{formatMoney(inv.outstandingCents, inv.currency)}</td>
                  <td className="mono">{inv.issuedOn ? new Date(inv.issuedOn).toISOString().slice(0, 10) : "—"}</td>
                  <td className="mono">{inv.dueOn ? new Date(inv.dueOn).toISOString().slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
