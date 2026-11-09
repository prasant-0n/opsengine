"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { RELEASE_STATUSES } from "../lib/releases";
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
    case "deployed":
      return "badge badge-tertiary";
    case "approved":
      return "badge badge-primary";
    case "review":
      return "badge badge-outline";
    case "rolled_back":
    case "cancelled":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function ReleasesPage() {
  const { can } = useShell();
  const [releases, setReleases] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [env, setEnv] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: "REL-2026-0002", title: "", targetEnv: "production", rollbackPlan: "" });
  const [saving, setSaving] = useState(false);

  const canCreate = can("release.create");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (env) params.set("env", env);
      const res = await fetch(`/api/releases?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setReleases(data.releases ?? []);
    } finally {
      setLoading(false);
    }
  }, [status, env]);

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
      const res = await fetch("/api/releases", {
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
      setForm({ number: "REL-2026-0003", title: "", targetEnv: "production", rollbackPlan: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Releases & Deployment Gates</h1>
          <p className="muted mono">release.read</p>
        </div>
        {canCreate && (
          <div className="action-row">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1 inline" />
              New release
            </button>
          </div>
        )}
      </header>

      {error && <div className="state-panel state-panel-error">{error}</div>}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Production / Staging Release</DialogTitle>
            <DialogDescription>
              Create a governed software release with deployment gate validation and rollback procedures.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid py-2">
            <label className="form-field">
              <span className="form-label">Release Number*</span>
              <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Title*</span>
              <input className="input" placeholder="e.g. Q4 Platform Rollout" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="form-field">
              <span className="form-label">Target Environment</span>
              <select className="input" value={form.targetEnv} onChange={(e) => setForm({ ...form, targetEnv: e.target.value })}>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Rollback Plan</span>
              <input className="input" placeholder="Rollback procedure" value={form.rollbackPlan} onChange={(e) => setForm({ ...form, rollbackPlan: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create release"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="panel">
        <div className="inline-form">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {RELEASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="input" value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="">All environments</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </div>

        {loading ? (
          <div className="state-panel state-panel-empty">Loading…</div>
        ) : releases.length === 0 ? (
          <div className="state-panel state-panel-empty">No releases found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Gates Passed</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((rel) => {
                const passedGates = (rel.gates ?? []).filter((g: any) => g.status === "passed" || g.status === "waived").length;
                const totalGates = (rel.gates ?? []).length;
                return (
                  <tr key={rel.id}>
                    <td>
                      <Link href={`/dashboard/releases/${rel.id}`} className="mono">
                        {rel.number}
                      </Link>
                    </td>
                    <td>{rel.title}</td>
                    <td><span className="badge badge-outline">{rel.targetEnv}</span></td>
                    <td>
                      <span className={statusBadge(rel.status)}>{rel.status}</span>
                    </td>
                    <td className="mono">{passedGates} / {totalGates}</td>
                    <td className="mono">{new Date(rel.createdAt).toISOString().slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
