"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { formatMoney } from "@/features/finance/lib/finance";
import { OFFER_STATUSES } from "../lib/offers";
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
    case "accepted":
      return "badge badge-tertiary";
    case "sent":
    case "approved":
      return "badge badge-primary";
    case "pending_approval":
      return "badge badge-outline";
    case "declined":
    case "withdrawn":
    case "expired":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function OffersPage() {
  const { can } = useShell();
  const [offers, setOffers] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ candidateId: "", templateId: "", jobTitle: "", baseCompCents: 0, currency: "USD", startDate: "", employmentType: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = can("recruit.offer.create");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const res = await fetch(`/api/recruit/offers?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setOffers(data.offers ?? []);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canCreate) return;
    fetch("/api/ats/candidates", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { candidates: [] }))
      .then((d) => setCandidates(d.candidates ?? []))
      .catch(() => {});
    fetch("/api/recruit/offer-templates?active=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, [canCreate]);

  async function create() {
    if (!form.candidateId || !form.jobTitle) {
      setError("Candidate and job title are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recruit/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: form.candidateId,
          templateId: form.templateId || undefined,
          jobTitle: form.jobTitle,
          baseCompCents: Number(form.baseCompCents) || 0,
          currency: form.currency,
          startDate: form.startDate || undefined,
          employmentType: form.employmentType || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setShowForm(false);
      setForm({ candidateId: "", templateId: "", jobTitle: "", baseCompCents: 0, currency: "USD", startDate: "", employmentType: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Offers</h1>
          <p className="muted mono">recruit.offer.read</p>
        </div>
        {canCreate && (
          <div className="action-row">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1 inline" />
              New offer
            </button>
          </div>
        )}
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Draft Offer Letter</DialogTitle>
            <DialogDescription>
              Draft an employment offer for a candidate in the recruitment pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid py-2">
            <label className="form-field">
              <span className="form-label">Candidate*</span>
              <select className="input" value={form.candidateId} onChange={(e) => setForm({ ...form, candidateId: e.target.value })}>
                <option value="">— select —</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Template</span>
              <select className="input" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
                <option value="">— none —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (v{t.version})
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Job title*</span>
              <input className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Base compensation (cents)</span>
              <input className="input" type="number" min={0} value={form.baseCompCents} onChange={(e) => setForm({ ...form, baseCompCents: Number(e.target.value) })} />
            </label>
            <label className="form-field">
              <span className="form-label">Currency</span>
              <input className="input" value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </label>
            <label className="form-field">
              <span className="form-label">Start date</span>
              <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
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
            {OFFER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Search number" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : offers.length === 0 ? (
          <div className="state-panel state-panel-empty">No offers.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Candidate</th>
                <th>Job title</th>
                <th>Base</th>
                <th>Status</th>
                <th>Start</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/dashboard/recruit/offers/${o.id}`} className="mono">
                      {o.number}
                    </Link>
                  </td>
                  <td>{o.candidateName ?? "—"}</td>
                  <td>{o.jobTitle}</td>
                  <td className="mono">{formatMoney(o.baseCompCents, o.currency)}</td>
                  <td>
                    <span className={statusBadge(o.status)}>{o.status}</span>
                  </td>
                  <td className="mono">{o.startDate ? new Date(o.startDate).toISOString().slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
