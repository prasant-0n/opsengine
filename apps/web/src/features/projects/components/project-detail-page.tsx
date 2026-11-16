"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";
import { formatCents, MILESTONE_STATUSES } from "@/features/projects/lib/projects";

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

export default function ProjectDetailPage({ id }: { id: string }) {
  const { can } = useShell();
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [milestoneForm, setMilestoneForm] = useState({ name: "", dueDate: "" });
  const [allocForm, setAllocForm] = useState({ employeeId: "", percentage: "50", startDate: "", endDate: "" });
  const [closeForm, setCloseForm] = useState("");

  const load = useCallback(() => {
    setState("loading");
    fetch(`/api/projects/${id}`)
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { setState("denied"); return null; }
        if (r.status === 404) { setState("error"); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (d) {
          setData(d);
          setEditForm({
            name: d.project.name,
            description: d.project.description ?? "",
            startDate: d.project.startDate ? d.project.startDate.slice(0, 10) : "",
            endDate: d.project.endDate ? d.project.endDate.slice(0, 10) : "",
            deliveryLeadId: d.project.deliveryLeadId ?? "",
            budget: d.project.budgetCents ? (Number(d.project.budgetCents) / 100).toFixed(2) : "",
          });
          setState("ok");
        }
      })
      .catch(() => setState("error"));
  }, [id]);

  useEffect(() => {
    if (can("project.read")) load(); else setState("denied");
    fetch("/api/org/employees?limit=100")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmployees((d.employees ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName }))))
      .catch(() => {});
  }, [can, load]);

  async function patch(body: any, okMsg: string) {
    setMsg(null);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: okMsg });
    load();
  }

  async function approve() {
    setMsg(null);
    const res = await fetch(`/api/projects/${id}/approve`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: "Project approved." });
    load();
  }

  async function cancel() {
    if (!closeForm.trim()) { setMsg({ type: "error", text: "Reason required to cancel." }); return; }
    setMsg(null);
    const res = await fetch(`/api/projects/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: closeForm }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: "Project cancelled." });
    setCloseForm("");
    load();
  }

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/projects/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: milestoneForm.name, dueDate: milestoneForm.dueDate || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMilestoneForm({ name: "", dueDate: "" });
    load();
  }

  async function addAllocation(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: id,
        employeeId: allocForm.employeeId,
        percentage: parseInt(allocForm.percentage, 10),
        startDate: allocForm.startDate,
        endDate: allocForm.endDate,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setAllocForm({ employeeId: "", percentage: "50", startDate: "", endDate: "" });
    load();
  }

  if (state === "denied") return <div className="state-panel-error">You do not have permission to view this project.</div>;
  if (state === "error") return <div className="state-panel-error">Project not found.</div>;
  if (!data) return <div className="state-panel-info">Loading…</div>;

  const { project, milestones, allocations, tickets, history, ownerName, deliveryLeadName, accountName } = data;
  const isActive = ["approved", "active", "on_hold", "pending_approval"].includes(project.status);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>{project.name}</h1>
          <p className="muted mono">{project.code} · {accountName ?? "internal"}</p>
        </div>
        <div className="badge-group">
          <span className={statusBadge(project.status)}>{project.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      {msg && <div className={msg.type === "ok" ? "state-panel-ok" : "state-panel-error"}>{msg.text}</div>}

      <div className="panel-grid">
        <div className="panel">
          <h2>Project</h2>
          {can("project.update") && isActive && (
            <form onSubmit={(e) => { e.preventDefault(); patch({ name: editForm.name, description: editForm.description, startDate: editForm.startDate || undefined, endDate: editForm.endDate || undefined, deliveryLeadId: editForm.deliveryLeadId || undefined, budget: editForm.budget || undefined }, "Project updated."); }}>
              <div className="form-grid">
                <label>Name<input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
                <label>Owner<span className="input mono">{ownerName ?? "—"}</span></label>
                <label>Delivery lead
                  <select className="input" value={editForm.deliveryLeadId} onChange={(e) => setEditForm({ ...editForm, deliveryLeadId: e.target.value })}>
                    <option value="">— select —</option>
                    {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
                  </select>
                </label>
                <label>Budget ($)<input className="input" value={editForm.budget} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} /></label>
                <label>Start<input className="input" type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} /></label>
                <label>End<input className="input" type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} /></label>
              </div>
              <label>Description<textarea className="input" rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
              <button className="btn btn-primary" type="submit">Save</button>
            </form>
          )}
          {(!can("project.update") || !isActive) && (
            <dl className="detail-list">
              <dt>Owner</dt><dd>{ownerName ?? "—"}</dd>
              <dt>Delivery lead</dt><dd>{deliveryLeadName ?? "—"}</dd>
              <dt>Budget</dt><dd className="mono">{formatCents(project.budgetCents)}</dd>
              <dt>Dates</dt><dd>{project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"} → {project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"}</dd>
              <dt>Description</dt><dd>{project.description ?? "—"}</dd>
            </dl>
          )}
        </div>

        <div className="panel">
          <h2>Actions</h2>
          <p className="state-panel-note mono mb-2">approval and cancellation are governed · audited</p>
          <div className="action-row">
            {can("project.approve") && project.status === "pending_approval" && (
              <button className="btn btn-primary" onClick={approve}>Approve project</button>
            )}
            {can("project.update") && !["completed", "cancelled"].includes(project.status) && (
              <div className="cancel-form">
                <input className="input" placeholder="Cancellation reason…" value={closeForm} onChange={(e) => setCloseForm(e.target.value)} />
                <button className="btn btn-danger" onClick={cancel}>Cancel project</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Milestones ({milestones.length})</h2>
          {can("project.update") && isActive && (
            <form className="inline-form" onSubmit={addMilestone}>
              <input className="input" placeholder="Milestone name*" value={milestoneForm.name} onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })} required />
              <input className="input" type="date" value={milestoneForm.dueDate} onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} />
              <button className="btn btn-secondary" type="submit">Add</button>
            </form>
          )}
          {milestones.length === 0 ? (
            <div className="state-panel-empty">No milestones.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {milestones.map((m: any) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "—"}</td>
                    <td><span className="badge badge-outline">{m.status.replace(/_/g, " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Allocations ({allocations.length})</h2>
          {can("allocation.create") && ["approved", "active", "on_hold"].includes(project.status) && (
            <form className="inline-form" onSubmit={addAllocation}>
              <select className="input" value={allocForm.employeeId} onChange={(e) => setAllocForm({ ...allocForm, employeeId: e.target.value })} required>
                <option value="">— employee —</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
              </select>
              <input className="input" type="number" min={1} max={100} value={allocForm.percentage} onChange={(e) => setAllocForm({ ...allocForm, percentage: e.target.value })} required />
              <input className="input" type="date" value={allocForm.startDate} onChange={(e) => setAllocForm({ ...allocForm, startDate: e.target.value })} required />
              <input className="input" type="date" value={allocForm.endDate} onChange={(e) => setAllocForm({ ...allocForm, endDate: e.target.value })} required />
              <button className="btn btn-secondary" type="submit">Allocate</button>
            </form>
          )}
          {allocations.length === 0 ? (
            <div className="state-panel-empty">No allocations.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Employee</th><th>%</th><th>Dates</th></tr></thead>
              <tbody>
                {allocations.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.employeeName ?? a.employeeId}</td>
                    <td className="mono">{a.percentage}%</td>
                    <td className="muted">{new Date(a.startDate).toLocaleDateString()} → {new Date(a.endDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Tickets ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <div className="state-panel-empty">No tickets linked.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Priority</th></tr></thead>
            <tbody>
              {tickets.map((t: any) => (
                <tr key={t.id}>
                  <td><Link href={`/dashboard/tickets/${t.id}`}>{t.title}</Link></td>
                  <td>{t.type}</td>
                  <td><span className="badge badge-outline">{t.status.replace(/_/g, " ")}</span></td>
                  <td><span className="badge badge-outline">{t.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>Stage history</h2>
        {history.length === 0 ? (
          <div className="state-panel-empty">No history.</div>
        ) : (
          <ul className="history-list">
            {history.map((h: any) => (
              <li key={h.id}>
                <span className="mono">{h.fromStatus ?? "—"} → {h.toStatus}</span>
                {h.reason && <span className="muted"> · {h.reason}</span>}
                <span className="muted"> · {new Date(h.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
