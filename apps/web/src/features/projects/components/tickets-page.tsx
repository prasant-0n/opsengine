"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { TICKET_STATUSES, TICKET_TYPES, TICKET_PRIORITIES } from "@/features/projects/lib/projects";
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
    case "resolved":
    case "closed":
      return "badge badge-tertiary";
    case "in_progress":
    case "in_review":
    case "triaged":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

function priorityBadge(p: string): string {
  switch (p) {
    case "critical":
      return "badge badge-error";
    case "high":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}

interface EmployeeOption { id: string; displayName: string }
interface ProjectOption { id: string; label: string }

export default function TicketsPage() {
  const { can } = useShell();
  const [rows, setRows] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({ title: "", projectId: "", type: "task", priority: "medium", assigneeId: "", description: "" });

  const load = useCallback(() => {
    setState("loading");
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    fetch(`/api/tickets${qs}`)
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { setState("denied"); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { if (d) { setRows(d.tickets ?? []); setState("ok"); } })
      .catch(() => setState("error"));
  }, [status]);

  useEffect(() => {
    if (can("ticket.read")) load(); else setState("denied");
    fetch("/api/org/employees?limit=100")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmployees((d.employees ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName }))))
      .catch(() => {});
    fetch("/api/projects?limit=100")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects((d.projects ?? []).map((p: any) => ({ id: p.id, label: `${p.code} · ${p.name}` }))))
      .catch(() => {});
  }, [can, load]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          projectId: form.projectId || undefined,
          type: form.type,
          priority: form.priority,
          assigneeId: form.assigneeId || undefined,
          description: form.description || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setShowForm(false);
      setForm({ title: "", projectId: "", type: "task", priority: "medium", assigneeId: "", description: "" });
      load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (state === "denied") return <div className="state-panel-error">You do not have permission to view tickets.</div>;
  if (state === "error") return <div className="state-panel-error">Failed to load tickets.</div>;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Tickets</h1>
          <p className="muted">ticket.read · work management</p>
        </div>
        {can("ticket.create") && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1 inline" />
            New ticket
          </button>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>
              Submit an issue, task, or bug ticket into the workforce backlog.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createTicket} className="space-y-4">
            {formError && <div className="state-panel-error">{formError}</div>}
            <div className="form-grid">
              <label className="form-field">
                <span className="form-label">Title *</span>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </label>
              <label className="form-field">
                <span className="form-label">Project</span>
                <select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">— none (tenant-wide) —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Type</span>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Priority</span>
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Assignee</span>
                <select className="input" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                  <option value="">— unassigned —</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
                </select>
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
                {saving ? "Creating…" : "Create ticket"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="panel">
        <div className="toolbar">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        {state === "loading" ? (
          <div className="state-panel-info">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="state-panel-empty">No tickets yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Project</th><th>Type</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Reporter</th></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/dashboard/tickets/${t.id}`}>{t.title}</Link></td>
                  <td className="muted">{t.projectName ?? "—"}</td>
                  <td>{t.type}</td>
                  <td><span className={statusBadge(t.status)}>{t.status.replace(/_/g, " ")}</span></td>
                  <td><span className={priorityBadge(t.priority)}>{t.priority}</span></td>
                  <td>{t.assigneeName ?? "—"}</td>
                  <td>{t.reporterName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
