"use client";

import { useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";

export default function OfferTemplatesPage() {
  const { can } = useShell();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", jobFamily: "", employmentType: "", body: "", defaultTermsDays: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = can("recruit.offer.create");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recruit/offer-templates", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!form.name || !form.body) {
      setError("Name and body are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recruit/offer-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          jobFamily: form.jobFamily || undefined,
          employmentType: form.employmentType || undefined,
          body: form.body,
          defaultTermsDays: form.defaultTermsDays ? Number(form.defaultTermsDays) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setShowForm(false);
      setForm({ name: "", jobFamily: "", employmentType: "", body: "", defaultTermsDays: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/recruit/offer-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Offer Templates</h1>
          <p className="muted mono">recruit.offer.read</p>
        </div>
        {canCreate && (
          <div className="action-row">
            <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "New template"}
            </button>
          </div>
        )}
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      {showForm && canCreate && (
        <div className="panel">
          <div className="panel-head">
            <h2>New template</h2>
          </div>
          <div className="form-grid">
            <label>
              Name*
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Job family
              <input className="input" value={form.jobFamily} onChange={(e) => setForm({ ...form, jobFamily: e.target.value })} />
            </label>
            <label>
              Employment type
              <input className="input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} />
            </label>
            <label>
              Default terms (days)
              <input className="input" type="number" min={0} value={form.defaultTermsDays} onChange={(e) => setForm({ ...form, defaultTermsDays: e.target.value })} />
            </label>
          </div>
          <label>
            Body*
            <textarea className="input" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          <div className="action-row">
            <button className="btn btn-primary" onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create template"}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="state-panel state-panel-empty">No templates.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Job family</th>
                <th>Employment type</th>
                <th>Version</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.jobFamily ?? "—"}</td>
                  <td>{t.employmentType ?? "—"}</td>
                  <td className="mono">v{t.version}</td>
                  <td>
                    <span className={t.active ? "badge badge-tertiary" : "badge badge-outline"}>{t.active ? "active" : "inactive"}</span>
                  </td>
                  <td>
                    {canCreate && (
                      <button className="link" onClick={() => toggleActive(t.id, !t.active)}>
                        {t.active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
