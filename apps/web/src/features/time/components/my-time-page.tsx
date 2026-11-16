"use client";

import { useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";
import {
  ITEM_STATUSES,
  ITEM_PRIORITIES,
  formatMinutes,
  deriveDailyReport,
  weekRange,
  sumTimeEntries,
} from "@/features/time/lib/time";

function planBadge(status: string): string {
  switch (status) {
    case "reviewed":
      return "badge badge-tertiary";
    case "submitted":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}
function itemBadge(status: string): string {
  switch (status) {
    case "completed":
      return "badge badge-tertiary";
    case "blocked":
      return "badge badge-error";
    case "in_progress":
      return "badge badge-primary";
    default:
      return "badge badge-outline";
  }
}
function attBadge(status: string): string {
  switch (status) {
    case "checked_out":
      return "badge badge-tertiary";
    case "checked_in":
      return "badge badge-primary";
    case "correction_requested":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

interface EmployeeOption { id: string; displayName: string }
interface ProjectOption { id: string; label: string }
interface TicketOption { id: string; title: string }

const TODAY = new Date().toISOString().slice(0, 10);

export default function MyTimePage() {
  const { can } = useShell();
  const [tab, setTab] = useState<"plan" | "worklog" | "attendance">("plan");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // shared option lists
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [tickets, setTickets] = useState<TicketOption[]>([]);

  // plan state
  const [plan, setPlan] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [itemForm, setItemForm] = useState({ title: "", projectId: "", ticketId: "", estimatedMinutes: "60", priority: "medium", plannedOutcome: "" });
  const [itemEdits, setItemEdits] = useState<Record<string, { status: string; actualMinutes: string; outcome: string }>>({});

  // worklog state
  const [entries, setEntries] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [entryForm, setEntryForm] = useState({ entryDate: TODAY, projectId: "", ticketId: "", minutes: "60", billable: false, note: "" });

  // attendance state
  const [day, setDay] = useState<any>(null);
  const [corrForm, setCorrForm] = useState({ reason: "", proposedCheckOut: "" });

  const loadProjectOpts = useCallback(() => {
    fetch("/api/projects?limit=100").then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects((d.projects ?? []).map((p: any) => ({ id: p.id, label: `${p.code} · ${p.name}` })))).catch(() => {});
    fetch("/api/tickets?limit=100").then((r) => (r.ok ? r.json() : { tickets: [] }))
      .then((d) => setTickets((d.tickets ?? []).map((t: any) => ({ id: t.id, title: t.title })))).catch(() => {});
  }, []);

  const loadPlan = useCallback(() => {
    setPlanLoading(true);
    fetch(`/api/time/plans?date=${TODAY}`)
      .then((r) => (r.ok ? r.json() : { plan: null, items: [] }))
      .then((d) => {
        setPlan(d.plan); setItems(d.items ?? []);
        const edits: any = {};
        for (const it of d.items ?? []) edits[it.id] = { status: it.status, actualMinutes: it.actualMinutes?.toString() ?? "", outcome: it.outcome ?? "" };
        setItemEdits(edits);
      })
      .catch(() => {})
      .finally(() => setPlanLoading(false));
  }, []);

  const loadEntries = useCallback(() => {
    const w = weekRange(TODAY);
    fetch(`/api/time/entries?from=${w.start}&to=${w.end}`)
      .then((r) => (r.ok ? r.json() : { entries: [], totals: null }))
      .then((d) => { setEntries(d.entries ?? []); setTotals(d.totals ?? null); })
      .catch(() => {});
  }, []);

  const loadAttendance = useCallback(() => {
    fetch(`/api/time/attendance?from=${TODAY}&to=${TODAY}`)
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d) => setDay((d.days ?? [])[0] ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadProjectOpts(); loadPlan(); loadEntries(); loadAttendance();
  }, [loadProjectOpts, loadPlan, loadEntries, loadAttendance]);

  async function ensurePlan(): Promise<any> {
    if (plan) return plan;
    const res = await fetch("/api/time/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: TODAY }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
    setPlan(d.plan); setItems(d.items ?? []);
    return d.plan;
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    try {
      const p = await ensurePlan();
      const res = await fetch(`/api/time/plans/${p.id}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...itemForm, projectId: itemForm.projectId || undefined, ticketId: itemForm.ticketId || undefined, plannedOutcome: itemForm.plannedOutcome || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setItemForm({ title: "", projectId: "", ticketId: "", estimatedMinutes: "60", priority: "medium", plannedOutcome: "" });
      setItems(d.items ?? []); setPlan((prev: any) => (prev ? { ...prev } : d.plan ?? prev));
      const edits: any = { ...itemEdits };
      for (const it of d.items ?? []) if (!edits[it.id]) edits[it.id] = { status: it.status, actualMinutes: it.actualMinutes?.toString() ?? "", outcome: it.outcome ?? "" };
      setItemEdits(edits);
    } catch (err: any) { setMsg({ type: "error", text: err.message }); }
  }

  async function saveItem(iid: string) {
    setMsg(null);
    const edit = itemEdits[iid];
    const res = await fetch(`/api/time/plans/${plan.id}/items/${iid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: edit.status, actualMinutes: edit.actualMinutes === "" ? null : parseInt(edit.actualMinutes, 10), outcome: edit.outcome }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setItems(d.items ?? []);
    setMsg({ type: "ok", text: "Item updated." });
  }

  async function submitPlan() {
    setMsg(null);
    const res = await fetch(`/api/time/plans/${plan.id}/submit`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: "Plan submitted." });
    loadPlan();
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const res = await fetch("/api/time/entries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entryForm, projectId: entryForm.projectId || undefined, ticketId: entryForm.ticketId || undefined, minutes: parseInt(entryForm.minutes, 10), note: entryForm.note || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setEntryForm({ entryDate: TODAY, projectId: "", ticketId: "", minutes: "60", billable: false, note: "" });
    setMsg({ type: "ok", text: "Time logged." });
    loadEntries();
  }

  async function checkAction(action: "check_in" | "check_out") {
    setMsg(null);
    const res = await fetch("/api/time/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: action === "check_in" ? "Checked in." : "Checked out." });
    loadAttendance();
  }

  async function requestCorrection(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!day) { setMsg({ type: "error", text: "No attendance record for today." }); return; }
    const res = await fetch("/api/time/attendance/corrections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceDayId: day.id, reason: corrForm.reason, proposedCheckOut: corrForm.proposedCheckOut || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setCorrForm({ reason: "", proposedCheckOut: "" });
    setMsg({ type: "ok", text: "Correction requested." });
    loadAttendance();
  }

  const report = deriveDailyReport(items);
  const canSubmit = can("time.dar.submit") && plan?.status === "draft";

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>My Time</h1>
          <p className="muted">time.entry.read_self · daily plan &amp; worklog</p>
        </div>
      </div>

      {msg && <div className={msg.type === "ok" ? "state-panel-ok" : "state-panel-error"}>{msg.text}</div>}

      <div className="tabs">
        <button className={tab === "plan" ? "tab tab-active" : "tab"} onClick={() => setTab("plan")}>Today's plan</button>
        <button className={tab === "worklog" ? "tab tab-active" : "tab"} onClick={() => setTab("worklog")}>Worklog</button>
        <button className={tab === "attendance" ? "tab tab-active" : "tab"} onClick={() => setTab("attendance")}>Attendance</button>
      </div>

      {tab === "plan" && (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>Plan · {TODAY}</h2>
              {plan && <span className={planBadge(plan.status)}>{plan.status}</span>}
            </div>
            {!planLoading && report && items.length > 0 && (
              <p className="muted mono">
                planned {formatMinutes(report.plannedMinutes)} · actual {formatMinutes(report.actualMinutes)} ·
                completed {report.completed} · blocked {report.blocked} · carried {report.carriedForward}
              </p>
            )}
            {(can("time.dar.create")) && plan?.status !== "submitted" && plan?.status !== "reviewed" && (
              <form className="inline-form" onSubmit={addItem}>
                <input className="input" placeholder="Task title*" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} required />
                <select className="input" value={itemForm.projectId} onChange={(e) => setItemForm({ ...itemForm, projectId: e.target.value })}>
                  <option value="">— project —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <select className="input" value={itemForm.ticketId} onChange={(e) => setItemForm({ ...itemForm, ticketId: e.target.value })}>
                  <option value="">— ticket —</option>
                  {tickets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <input className="input" type="number" min={1} max={1440} value={itemForm.estimatedMinutes} onChange={(e) => setItemForm({ ...itemForm, estimatedMinutes: e.target.value })} />
                <select className="input" value={itemForm.priority} onChange={(e) => setItemForm({ ...itemForm, priority: e.target.value })}>
                  {ITEM_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="btn btn-secondary" type="submit">Add item</button>
              </form>
            )}
            {planLoading ? (
              <div className="state-panel-info">Loading…</div>
            ) : items.length === 0 ? (
              <div className="state-panel-empty">No plan items yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Task</th><th>Est.</th><th>Status</th><th>Actual</th><th>Outcome</th><th></th></tr></thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.title}</td>
                      <td className="mono">{formatMinutes(it.estimatedMinutes)}</td>
                      <td>
                        {plan?.status === "draft" ? (
                          <select className="input" value={itemEdits[it.id]?.status ?? it.status} onChange={(e) => setItemEdits({ ...itemEdits, [it.id]: { ...itemEdits[it.id], status: e.target.value } })}>
                            {ITEM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                          </select>
                        ) : (
                          <span className={itemBadge(it.status)}>{it.status.replace(/_/g, " ")}</span>
                        )}
                      </td>
                      <td>
                        {plan?.status === "draft" ? (
                          <input className="input" type="number" min={0} max={1440} style={{ width: 80 }} value={itemEdits[it.id]?.actualMinutes ?? ""} onChange={(e) => setItemEdits({ ...itemEdits, [it.id]: { ...itemEdits[it.id], actualMinutes: e.target.value } })} />
                        ) : (
                          <span className="mono">{formatMinutes(it.actualMinutes)}</span>
                        )}
                      </td>
                      <td>
                        {plan?.status === "draft" ? (
                          <input className="input" value={itemEdits[it.id]?.outcome ?? ""} onChange={(e) => setItemEdits({ ...itemEdits, [it.id]: { ...itemEdits[it.id], outcome: e.target.value } })} placeholder="outcome" />
                        ) : (
                          it.outcome ?? "—"
                        )}
                      </td>
                      <td>{plan?.status === "draft" && <button className="btn btn-secondary" onClick={() => saveItem(it.id)}>Save</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {canSubmit && (
              <div className="action-row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={submitPlan}>Submit plan (governed)</button>
              </div>
            )}
            {plan && plan.status !== "draft" && <p className="state-panel-note mono">plan is {plan.status}; content is immutable</p>}
          </div>
        </>
      )}

      {tab === "worklog" && (
        <div className="panel">
          <h2>Worklog · this week</h2>
          <form className="inline-form" onSubmit={addEntry}>
            <input className="input" type="date" value={entryForm.entryDate} onChange={(e) => setEntryForm({ ...entryForm, entryDate: e.target.value })} required />
            <select className="input" value={entryForm.projectId} onChange={(e) => setEntryForm({ ...entryForm, projectId: e.target.value })}>
              <option value="">— project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select className="input" value={entryForm.ticketId} onChange={(e) => setEntryForm({ ...entryForm, ticketId: e.target.value })}>
              <option value="">— ticket —</option>
              {tickets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <input className="input" type="number" min={1} max={1440} value={entryForm.minutes} onChange={(e) => setEntryForm({ ...entryForm, minutes: e.target.value })} />
            <label className="checkbox-label"><input type="checkbox" checked={entryForm.billable} onChange={(e) => setEntryForm({ ...entryForm, billable: e.target.checked })} /> billable</label>
            <button className="btn btn-secondary" type="submit">Log time</button>
          </form>
          {entries.length === 0 ? (
            <div className="state-panel-empty">No time logged this week.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Project</th><th>Ticket</th><th>Minutes</th><th>Billable</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.entryDate).toLocaleDateString()}</td>
                    <td className="muted">{e.projectName ?? "—"}</td>
                    <td className="muted">{e.ticketTitle ?? "—"}</td>
                    <td className="mono">{formatMinutes(e.minutes)}</td>
                    <td>{e.billable ? <span className="badge badge-tertiary">billable</span> : <span className="badge badge-outline">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {totals && (
            <p className="muted mono" style={{ marginTop: 8 }}>
              total {formatMinutes(totals.totalMinutes)} · billable {formatMinutes(totals.billableMinutes)} · non-billable {formatMinutes(totals.nonBillableMinutes)}
            </p>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="panel">
          <div className="panel-head">
            <h2>Attendance · {TODAY}</h2>
            {day && <span className={attBadge(day.status)}>{day.status.replace(/_/g, " ")}</span>}
          </div>
          <div className="action-row">
            {can("time.attendance.checkin") && (!day || day.status === "not_checked_in") && (
              <button className="btn btn-primary" onClick={() => checkAction("check_in")}>Check in</button>
            )}
            {can("time.attendance.checkin") && day?.status === "checked_in" && (
              <button className="btn btn-secondary" onClick={() => checkAction("check_out")}>Check out</button>
            )}
          </div>
          {day?.checkInAt && <p className="muted mono">in: {new Date(day.checkInAt).toLocaleTimeString()} {day.checkOutAt ? `· out: ${new Date(day.checkOutAt).toLocaleTimeString()}` : ""}</p>}
          {can("time.attendance.correct") && day && day.status !== "not_checked_in" && (
            <form className="cancel-form" style={{ marginTop: 12 }} onSubmit={requestCorrection}>
              <input className="input" placeholder="Correction reason*" value={corrForm.reason} onChange={(e) => setCorrForm({ ...corrForm, reason: e.target.value })} required />
              <input className="input" type="datetime-local" value={corrForm.proposedCheckOut} onChange={(e) => setCorrForm({ ...corrForm, proposedCheckOut: e.target.value })} />
              <button className="btn btn-secondary" type="submit">Request correction</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
