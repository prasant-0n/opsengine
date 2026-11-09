"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { formatMoney } from "@/features/finance/lib/finance";
import { PRESALES_STATUSES } from "../lib/presales";
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
    case "approved":
      return "badge badge-tertiary";
    case "submitted":
      return "badge badge-primary";
    case "draft":
      return "badge badge-outline";
    case "rejected":
    case "expired":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function PresalesPage() {
  const { can } = useShell();
  const [proposals, setProposals] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: "PROP-2026-0001", title: "", currency: "USD", marginPct: 0.2, notes: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = can("presales.proposal.create");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/presales/proposals?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setProposals(data.proposals ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!form.number || !form.title) {
      setError("Number and title are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/presales/proposals", {
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
      setForm({ number: "PROP-2026-0002", title: "", currency: "USD", marginPct: 0.2, notes: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Presales & Proposals</h1>
          <p className="muted mono">presales.proposal.read</p>
        </div>
        {canCreate && (
          <div className="action-row">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1 inline" />
              New proposal
            </button>
          </div>
        )}
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Presales Proposal</DialogTitle>
            <DialogDescription>
              Create a new client estimate proposal. Line items and totals can be configured after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid py-2">
            <label className="form-field">
              <span className="form-label">Proposal Number*</span>
              <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Title*</span>
              <input className="input" placeholder="e.g. Enterprise Migration Estimate" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Currency</span>
              <input className="input" value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </label>
            <label className="form-field">
              <span className="form-label">Target Margin (%)</span>
              <input className="input" type="number" step="0.05" value={form.marginPct} onChange={(e) => setForm({ ...form, marginPct: Number(e.target.value) })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create proposal"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="panel">
        <div className="inline-form">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {PRESALES_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : proposals.length === 0 ? (
          <div className="state-panel state-panel-empty">No proposals found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Status</th>
                <th>Total Estimate</th>
                <th>Margin</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((prop) => (
                <tr key={prop.id}>
                  <td>
                    <Link href={`/dashboard/presales/${prop.id}`} className="mono">
                      {prop.number}
                    </Link>
                  </td>
                  <td>{prop.title}</td>
                  <td>
                    <span className={statusBadge(prop.status)}>{prop.status}</span>
                  </td>
                  <td className="mono">{formatMoney(prop.totalAmountCents, prop.currency)}</td>
                  <td className="mono">{(prop.marginPct * 100).toFixed(0)}%</td>
                  <td className="mono">{new Date(prop.createdAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
