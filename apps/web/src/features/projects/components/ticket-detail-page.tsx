"use client";

import { useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";
import { TICKET_STATUSES, TICKET_TYPES, TICKET_PRIORITIES, canTransitionTicket, isGovernedTicketStatus } from "@/features/projects/lib/projects";

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

export default function TicketDetailPage({ id }: { id: string }) {
  const { can } = useShell();
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [closeReason, setCloseReason] = useState("");

  const load = useCallback(() => {
    setState("loading");
    fetch(`/api/tickets/${id}`)
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
            title: d.ticket.title,
            description: d.ticket.description ?? "",
            type: d.ticket.type,
            priority: d.ticket.priority,
            assigneeId: d.ticket.assigneeId ?? "",
          });
          setState("ok");
        }
      })
      .catch(() => setState("error"));
  }, [id]);

  useEffect(() => {
    if (can("ticket.read")) load(); else setState("denied");
    fetch("/api/org/employees?limit=100")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmployees((d.employees ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName }))))
      .catch(() => {});
  }, [can, load]);

  async function transition(to: string) {
    setMsg(null);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: `Moved to ${to.replace(/_/g, " ")}.` });
    load();
  }

  async function saveFields(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        description: editForm.description,
        type: editForm.type,
        priority: editForm.priority,
        assigneeId: editForm.assigneeId || undefined,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: "Ticket updated." });
    load();
  }

  async function closeTicket() {
    if (!closeReason.trim()) { setMsg({ type: "error", text: "Close reason required." }); return; }
    setMsg(null);
    const res = await fetch(`/api/tickets/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: closeReason }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: "Ticket closed." });
    setCloseReason("");
    load();
  }

  if (state === "denied") return <div className="state-panel-error">You do not have permission to view this ticket.</div>;
  if (state === "error") return <div className="state-panel-error">Ticket not found.</div>;
  if (!data) return <div className="state-panel-info">Loading…</div>;

  const { ticket, projectName, assigneeName, reporterName, history } = data;
  const isOpen = ticket.status !== "closed";
  const nextStatuses = TICKET_STATUSES.filter((s) => canTransitionTicket(ticket.status as any, s) && !isGovernedTicketStatus(s));

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>{ticket.title}</h1>
          <p className="muted mono">{ticket.id.slice(0, 8)} · {projectName ?? "tenant-wide"}</p>
        </div>
        <div className="badge-group">
          <span className={statusBadge(ticket.status)}>{ticket.status.replace(/_/g, " ")}</span>
          <span className={priorityBadge(ticket.priority)}>{ticket.priority}</span>
        </div>
      </div>

      {msg && <div className={msg.type === "ok" ? "state-panel-ok" : "state-panel-error"}>{msg.text}</div>}

      <div className="panel-grid">
        <div className="panel">
          <h2>Ticket</h2>
          {can("ticket.update") && isOpen ? (
            <form onSubmit={saveFields}>
              <div className="form-grid">
                <label>Title<input className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></label>
                <label>Type
                  <select className="input" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                    {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>Priority
                  <select className="input" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                    {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>Assignee
                  <select className="input" value={editForm.assigneeId} onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}>
                    <option value="">— unassigned —</option>
                    {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
                  </select>
                </label>
              </div>
              <label>Description<textarea className="input" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
              <button className="btn btn-primary" type="submit">Save</button>
            </form>
          ) : (
            <dl className="detail-list">
              <dt>Type</dt><dd>{ticket.type}</dd>
              <dt>Priority</dt><dd>{ticket.priority}</dd>
              <dt>Assignee</dt><dd>{assigneeName ?? "—"}</dd>
              <dt>Reporter</dt><dd>{reporterName ?? "—"}</dd>
              <dt>Description</dt><dd>{ticket.description ?? "—"}</dd>
              {ticket.closedReason && (<><dt>Closed reason</dt><dd>{ticket.closedReason}</dd></>)}
            </dl>
          )}
        </div>

        <div className="panel">
          <h2>Transitions</h2>
          <p className="state-panel-note mono mb-2">normal moves (closing is governed · audited)</p>
          {isOpen && nextStatuses.length > 0 && (
            <div className="action-row">
              {nextStatuses.map((s) => (
                <button key={s} className="btn btn-secondary" onClick={() => transition(s)}>
                  → {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
          {isOpen && can("ticket.close") && (
            <div className="cancel-form" style={{ marginTop: "12px" }}>
              <input className="input" placeholder="Close reason (required)…" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
              <button className="btn btn-danger" onClick={closeTicket}>Close ticket</button>
            </div>
          )}
          {!isOpen && <div className="state-panel-empty">Ticket is closed (terminal).</div>}
        </div>
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
