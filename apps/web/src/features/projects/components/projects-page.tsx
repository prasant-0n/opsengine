"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { PROJECT_STATUSES, formatCents } from "@/features/projects/lib/projects";
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
    case "active":
    case "approved":
    case "completed":
      return "badge badge-tertiary";
    case "proposed":
    case "pending_approval":
    case "on_hold":
      return "badge badge-primary";
    case "cancelled":
      return "badge badge-outline";
    default:
      return "badge badge-outline";
  }
}

interface EmployeeOption { id: string; displayName: string }
interface AccountOption { id: string; name: string }

function useEmployees(): EmployeeOption[] {
  const [emps, setEmps] = useState<EmployeeOption[]>([]);
  useEffect(() => {
    fetch("/api/org/employees?limit=100")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmps((d.employees ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName }))))
      .catch(() => setEmps([]));
  }, []);
  return emps;
}

function useAccounts(): AccountOption[] {
  const [accts, setAccts] = useState<AccountOption[]>([]);
  useEffect(() => {
    fetch("/api/crm/accounts?limit=100")
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setAccts((d.accounts ?? []).map((a: any) => ({ id: a.id, name: a.name }))))
      .catch(() => setAccts([]));
  }, []);
  return accts;
}

export default function ProjectsPage() {
  const { can } = useShell();
  const employees = useEmployees();
  const accounts = useAccounts();
  const [rows, setRows] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", code: "", accountId: "", ownerId: "", deliveryLeadId: "",
    startDate: "", endDate: "", budget: "", description: "",
  });

  const load = useCallback(() => {
    setState("loading");
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    fetch(`/api/projects${qs}`)
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { setState("denied"); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { if (d) { setRows(d.projects ?? []); setState("ok"); } })
      .catch(() => setState("error"));
  }, [status]);

  useEffect(() => { if (can("project.read")) load(); else setState("denied"); }, [can, load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, code: form.code,
          accountId: form.accountId || undefined,
          ownerId: form.ownerId,
          deliveryLeadId: form.deliveryLeadId || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          budget: form.budget || undefined,
          description: form.description || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setShowForm(false);
      setForm({ name: "", code: "", accountId: "", ownerId: "", deliveryLeadId: "", startDate: "", endDate: "", budget: "", description: "" });
      load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (state === "denied") return <div className="state-panel-error">You do not have permission to view projects.</div>;
  if (state === "error") return <div className="state-panel-error">Failed to load projects.</div>;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">project.read · portfolio</p>
        </div>
        {can("project.create") && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1 inline" />
            New project
          </button>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Initialize a project portfolio workspace, allocate team resources and set budgets.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createProject} className="space-y-4">
            {formError && <div className="state-panel-error">{formError}</div>}
            <div className="form-grid">
              <label className="form-field">
                <span className="form-label">Name *</span>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="form-field">
                <span className="form-label">Code *</span>
                <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </label>
              <label className="form-field">
                <span className="form-label">Client account</span>
                <select className="input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                  <option value="">— none (internal) —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Owner *</span>
                <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} required>
                  <option value="">— select —</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Delivery lead</span>
                <select className="input" value={form.deliveryLeadId} onChange={(e) => setForm({ ...form, deliveryLeadId: e.target.value })}>
                  <option value="">— select —</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Start date</span>
                <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </label>
              <label className="form-field">
                <span className="form-label">End date</span>
                <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </label>
              <label className="form-field">
                <span className="form-label">Budget ($)</span>
                <input className="input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0.00" />
              </label>
            </div>
            <label className="form-field">
              <span className="form-label">Description</span>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="panel">
        <div className="toolbar">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        {state === "loading" ? (
          <div className="state-panel-info">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="state-panel-empty">No projects yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Status</th><th>Owner</th><th>Delivery lead</th><th>Budget</th><th>Dates</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td><Link href={`/dashboard/projects/${p.id}`}>{p.name}</Link></td>
                  <td><span className={statusBadge(p.status)}>{p.status.replace(/_/g, " ")}</span></td>
                  <td>{p.ownerName ?? "—"}</td>
                  <td>{p.deliveryLeadName ?? "—"}</td>
                  <td className="mono">{formatCents(p.budgetCents)}</td>
                  <td className="muted">{p.startDate ? new Date(p.startDate).toLocaleDateString() : "—"} → {p.endDate ? new Date(p.endDate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
