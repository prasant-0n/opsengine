"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
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
    case "completed":
      return "badge badge-tertiary";
    case "active":
      return "badge badge-primary";
    case "cancelled":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function OnboardingOverviewPage() {
  const { can } = useShell();
  const [plans, setPlans] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ offerId: "", employmentType: "", location: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = can("onboarding.plan.create");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/onboarding/plans?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setPlans(data.plans ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canCreate) return;
    fetch("/api/recruit/offers?status=accepted", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d) => setOffers(d.offers ?? []))
      .catch(() => {});
  }, [canCreate]);

  async function create() {
    if (!form.offerId) {
      setError("Select an accepted offer");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: form.offerId, employmentType: form.employmentType || undefined, location: form.location || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setShowForm(false);
      setForm({ offerId: "", employmentType: "", location: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Onboarding</h1>
          <p className="muted mono">onboarding.plan.read</p>
        </div>
        {canCreate && (
          <div className="action-row">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1 inline" />
              New plan
            </button>
          </div>
        )}
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Onboarding Plan</DialogTitle>
            <DialogDescription>
              Initialize a pre-boarding and induction checklist from an accepted candidate offer.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid py-2">
            <label className="form-field">
              <span className="form-label">Accepted offer*</span>
              <select className="input" value={form.offerId} onChange={(e) => setForm({ ...form, offerId: e.target.value })}>
                <option value="">— select —</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.number} · {o.candidateName ?? o.jobTitle}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Employment type</span>
              <input className="input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Location</span>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create plan"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="panel">
        <div className="inline-form">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="state-panel state-panel-empty">No onboarding plans.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Start</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/dashboard/onboarding/plans/${p.id}`}>{p.candidateName ?? "—"}</Link>
                  </td>
                  <td>
                    <span className={statusBadge(p.status)}>{p.status}</span>
                  </td>
                  <td className="mono">{p.completionPct ?? 0}%</td>
                  <td className="mono">{p.startedOn ? new Date(p.startedOn).toISOString().slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
